import { createSepayOrderCode, createSepayPayment, isSepayConfigured, sepayOrderCodeFromPaymentCode, sepayQrUrl, verifySepayCallback } from './sepayGateway.js';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import CreditPackage from '../models/CreditPackage.js';
import CreditPricing from '../models/CreditPricing.js';
import PaymentOrder, { type IPaymentOrder, type PaymentGateway } from '../models/PaymentOrder.js';
import { createMomoPayment, isMomoConfigured, verifyMomoCallback } from './momoGateway.js';
import type { GatewayCallbackResult } from './paymentGatewayTypes.js';
import { createVnpayPayment, isVnpayConfigured, verifyVnpayCallback } from './vnpayGateway.js';
import { getPayosPaymentInfo, isPayosConfigured, verifyPayosCallback } from './payosGateway.js';
import { ensureWallet, grantTopupCredits } from './creditWalletService.js';
import { recordUserAudit } from './auditService.js';
import { supportsTransactions, withTransaction } from './transactionService.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

type OrderDocument = mongoose.HydratedDocument<IPaymentOrder>;

function unavailable(message: string): never {
  throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message });
}

function orderView(order: OrderDocument, redirectUrl?: string) {
  if (order.gateway === 'SEPAY' && order.status === 'PENDING') {
    const paymentCode = order.bankTransfer?.content.trim().split(/\s+/).at(-1);
    if (!paymentCode || sepayOrderCodeFromPaymentCode(paymentCode) !== order.orderCode) {
      unavailable('Nội dung chuyển khoản không khớp mã đơn đã lưu. Vui lòng liên hệ hỗ trợ.');
    }
  }
  return {
    id: order.id, orderCode: order.orderCode, gateway: order.gateway, status: order.status,
    source: order.source, amountVnd: order.amountVnd, baseCredits: order.baseCredits,
    bonusCredits: order.bonusCredits, grantCredits: order.grantCredits,
    ...(order.bankTransfer ? { bankTransfer: {
      bankName: order.bankTransfer.bankName, accountNumber: order.bankTransfer.accountNumber,
      accountHolder: order.bankTransfer.accountHolder, content: order.bankTransfer.content,
    } } : {}),
    ...(order.gateway === 'SEPAY' && order.bankTransfer && order.status === 'PENDING'
      ? { qrCodeUrl: sepayQrUrl(order.bankTransfer, order.amountVnd) } : {}),
    expiresAt: order.expiresAt, ...(redirectUrl ? { redirectUrl } : {}),
  };
}

export function gatewayAvailability() {
  return {
    SEPAY: isSepayConfigured(),
    PAYOS: false, // Legacy callbacks only; no new PayOS orders.
    VNPAY: isVnpayConfigured(),
    MOMO: isMomoConfigured(),
  };
}

export async function listActivePackages() {
  const packages = await CreditPackage.find({ active: true }).sort({ sortOrder: 1, amountVnd: 1 }).lean();
  return packages.map((item) => ({
    id: String(item._id),
    name: item.name,
    description: item.description,
    amountVnd: item.amountVnd,
    baseCredits: item.baseCredits,
    bonusCredits: item.bonusCredits,
    grantCredits: item.baseCredits + item.bonusCredits,
  }));
}

export async function createPaymentOrder(
  userId: string,
  input: { gateway: PaymentGateway; packageId?: string; customAmountVnd?: number },
  ipAddress: string,
) {
  const gateway = input.gateway || 'SEPAY';
  if (gateway === 'PAYOS') unavailable('PayOS đã ngừng tạo đơn mới. Vui lòng sử dụng SePay.');
  if (gateway === 'SEPAY' && !isSepayConfigured()) unavailable('SePay chưa được cấu hình đầy đủ.');
  if (gateway === 'SEPAY' && !(await supportsTransactions())) unavailable('Thanh toán SePay cần MongoDB replica set để cộng credit an toàn.');
  if (gateway === 'VNPAY' && !isVnpayConfigured()) unavailable('VNPay chưa được cấu hình.');
  if (gateway === 'MOMO' && !isMomoConfigured()) unavailable('MoMo chưa được cấu hình.');

  const wallet = await ensureWallet(userId);
  let source: 'PACKAGE' | 'CUSTOM';
  let packageId: mongoose.Types.ObjectId | undefined;
  let amountVnd: number;
  let baseCredits: number;
  let bonusCredits: number;

  if (input.packageId) {
    const selected = await CreditPackage.findOne({ _id: input.packageId, active: true });
    if (!selected) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Không tìm thấy gói credit đang hoạt động.',
      });
    }
    source = 'PACKAGE';
    packageId = selected._id;
    amountVnd = selected.amountVnd;
    baseCredits = selected.baseCredits;
    bonusCredits = selected.bonusCredits;
  } else {
    const pricing = await CreditPricing.findOne({ key: 'GLOBAL' }).lean();
    if (!pricing) unavailable('Chính sách quy đổi credit chưa được cấu hình.');
    source = 'CUSTOM';
    amountVnd = input.customAmountVnd!;
    baseCredits = Math.floor(amountVnd / pricing.vndPerCredit);
    bonusCredits = 0;
  }

  if (!Number.isSafeInteger(baseCredits + bonusCredits) || baseCredits + bonusCredits <= 0) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Số tiền nạp chưa đủ để quy đổi credit.' });
  }

  let orderCode = gateway === 'SEPAY'
    ? createSepayOrderCode()
    : `CR${Date.now().toString(36).toUpperCase()}${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  if (gateway === 'SEPAY') {
    let attempts = 0;
    while (await PaymentOrder.exists({ orderCode })) {
      if (++attempts >= 10) unavailable('Chưa thể tạo mã thanh toán. Vui lòng thử lại.');
      orderCode = createSepayOrderCode();
    }
  }
  // The unique orderCode index also rejects a concurrent collision before showing a QR.
  const bankTransfer = gateway === 'SEPAY' ? createSepayPayment({ orderCode, amountVnd }) : undefined;
  const requestId = `REQ-${orderCode}`;
  const order = await PaymentOrder.create({
    userId,
    walletId: wallet._id,
    gateway,
    bankTransfer,
    orderCode,
    status: 'PENDING',
    source,
    packageId,
    amountVnd,
    baseCredits,
    bonusCredits,
    grantCredits: baseCredits + bonusCredits,
    gatewayRequestId: requestId,
    expiresAt: new Date(Date.now() + 15 * 60_000),
    grantIdempotencyKey: `payment-grant:${orderCode}`,
  });

  const description = `Nap credit ${orderCode.slice(-10)}`;
  let redirectUrl: string | undefined;

  if (gateway === 'SEPAY') {
    // Creation and polling share the same QR source: the saved order snapshot.
    return orderView(order);
  } else if (gateway === 'VNPAY') {
    const result = createVnpayPayment({ orderCode, amountVnd, description, ipAddress });
    if (!result.configured) unavailable('VNPay chưa được cấu hình.');
    redirectUrl = result.redirectUrl;
  } else {
    const result = await createMomoPayment({ orderCode, requestId, amountVnd, description });
    if (!result.configured) unavailable('MoMo chưa được cấu hình.');
    redirectUrl = result.redirectUrl;
  }

  return orderView(order, redirectUrl);
}

export async function getPaymentOrder(userId: string, id: string) {
  let order = await PaymentOrder.findOne({ _id: id, userId });
  if (!order) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đơn nạp credit.' });

  if (order.status === 'PENDING') {
    if (order.gateway === 'PAYOS' && isPayosConfigured()) {
      const info = await getPayosPaymentInfo(Number(order.orderCode));
      if (info && info.status === 'PAID') {
        const transactionId = (info as unknown as { transactions?: Array<{ reference?: string }> }).transactions?.[0]?.reference || info.id || String(info.orderCode);
        return await settleVerifiedCallback('PAYOS', {
          valid: true,
          orderCode: String(info.orderCode),
          amountVnd: info.amount,
          transactionId,
          resultCode: '00',
          success: true,
        });
      }
    }
    if (order.expiresAt.getTime() <= Date.now()) {
      order = await PaymentOrder.findOneAndUpdate({ _id: order._id, status: 'PENDING' }, { $set: { status: 'EXPIRED' } }, { returnDocument: 'after' }) || order;
    }
  }
  return orderView(order);
}

async function settleVerifiedCallback(gateway: PaymentGateway, verified: GatewayCallbackResult) {
  if (!verified.valid) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Invalid payment callback signature.' });
  if (!verified.orderCode) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Payment callback is missing order code.' });
  const centerLookup = await runWithSystemCenterAccess(() => PaymentOrder.findOne({ orderCode: verified.orderCode, gateway }).select({ centerId: 1 }).lean());
  const centerId = String((centerLookup as (typeof centerLookup & { centerId?: unknown }) | null)?.centerId || '');
  if (!centerId) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đơn thanh toán.' });
  return runWithCenter(centerId, async () => {
  try {
    if (!verified.valid) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Chữ ký callback thanh toán không hợp lệ.' });
    if (!verified.orderCode) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Callback thiếu mã đơn thanh toán.' });
    if (gateway === 'SEPAY' && !(await supportsTransactions())) unavailable('Thanh toán SePay cần MongoDB replica set để cộng credit an toàn.');
    const settle = async (session: mongoose.ClientSession) => {
    const order = await PaymentOrder.findOne({ orderCode: verified.orderCode, gateway }).session(session);
    if (!order) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy đơn thanh toán.' });
    if (gateway === 'SEPAY') {
      const expected = order.bankTransfer;
      const recipient = verified.recipient;
      // Match the order snapshot, so note changes do not invalidate in-flight orders.
      const paymentCode = expected?.content.trim().split(/\s+/).at(-1)?.toUpperCase();
      if (!paymentCode || paymentCode !== verified.paymentCode) {
        throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Mã thanh toán SePay không khớp nội dung của đơn.' });
      }
      if (!expected || !recipient
        || expected.webhookAccountNumber !== recipient.accountNumber
        || expected.bankName.toUpperCase() !== recipient.bankName.toUpperCase()
        || expected.subAccount !== recipient.subAccount) {
        throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Tài khoản nhận tiền SePay không khớp đơn thanh toán.' });
      }
    }
    if (verified.amountVnd !== order.amountVnd) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Số tiền callback không khớp đơn thanh toán.' });
    if (!verified.success) {
      if (order.status === 'PENDING' || order.status === 'EXPIRED') {
        order.status = 'FAILED'; order.gatewayResultCode = verified.resultCode; await order.save({ session });
      }
      return orderView(order);
    }
    const transactionId = verified.transactionId?.trim();
    if (!transactionId) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Callback thiếu mã giao dịch cổng thanh toán.' });
    if (order.status === 'PAID') {
      if (order.gatewayTransactionId !== transactionId) throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Đơn đã được thanh toán bằng giao dịch khác.' });
      return orderView(order);
    }
    if (order.status === 'FAILED') throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Đơn thanh toán đã thất bại.' });
    const conflict = await PaymentOrder.exists({ gateway, gatewayTransactionId: transactionId, _id: { $ne: order._id } }).session(session);
    if (conflict) throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Giao dịch cổng thanh toán đã được sử dụng.' });
    order.status = 'PAID'; order.gatewayTransactionId = transactionId;
    order.gatewayResultCode = verified.resultCode; order.paidAt = new Date(); await order.save({ session });
    await grantTopupCredits({ userId: String(order.userId), paymentOrderId: order.id, credits: order.grantCredits, idempotencyKey: order.grantIdempotencyKey }, session);
    await recordUserAudit(String(order.userId), {
      action: 'CREDIT_PAYMENT_GRANTED', resourceType: 'payment_order', resourceId: order.id,
      metadata: { credits: order.grantCredits, amountVnd: order.amountVnd, gateway },
    }, session);
    return orderView(order);
    };
    return await (gateway === 'SEPAY' ? mongoose.connection.transaction(settle) : withTransaction(settle));
  } catch (error) {
    if (verified.orderCode) {
      const order = await PaymentOrder.findOne({ orderCode: verified.orderCode, gateway }).select({ _id: 1, userId: 1 }).lean();
      if (order) {
        const reasonCode = error instanceof AppError ? error.code : ERROR_CODES.INTERNAL;
        await recordUserAudit(String(order.userId), {
          action: 'CREDIT_PAYMENT_CALLBACK_REJECTED', resourceType: 'payment_order', resourceId: String(order._id),
          metadata: { gateway, reasonCode, ...(verified.amountVnd === undefined ? {} : { amountVnd: verified.amountVnd }) },
        }).catch(() => undefined);
      }
    }
    throw error;
  }
  });
}

export async function settlePayosCallback(input: Record<string, unknown>) {
  return settleVerifiedCallback('PAYOS', await verifyPayosCallback(input));
}
export function settleVnpayCallback(input: Record<string, unknown>) { return settleVerifiedCallback('VNPAY', verifyVnpayCallback(input)); }
export function settleMomoCallback(input: Record<string, unknown>) { return settleVerifiedCallback('MOMO', verifyMomoCallback(input)); }

export async function settleSepayCallback(input: Record<string, unknown>, authorization?: string) {
  const verified = verifySepayCallback(input, authorization);
  if (!verified) return { ignored: true };
  return settleVerifiedCallback('SEPAY', verified);
}

export async function getTopupRate() {
  const pricing = await CreditPricing.findOne({ key: 'GLOBAL' }).select('vndPerCredit').lean();
  return pricing?.vndPerCredit ?? null;
}
