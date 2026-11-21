import mongoose from "mongoose";
import { CompanyModel } from "../../../model/company.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailSePayTransactionModel } from "../models/retail-sepay-transaction.model";
import { publishRetailOrderEvent } from "./retail-order-events";
import { awardOrderPoints, legacyRetailPaymentCode, paymentStatusFor, retailPaymentCode } from "./retail-order.service";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { businessDateInVietnam, emitSessionChange } from "./cashier-shift.service";
import { emitToUser } from "../../../socket";
import { decryptSecret } from "../../../security/crypto";
import crypto from "node:crypto";
import { reconcileCommission } from "./retail-collaborator-adapter";

export type SePayPayload = {
  id?: string | number; gateway?: string; transactionDate?: string; accountNumber?: string | number;
  code?: string | null; content?: string; description?: string; transferType?: string;
  transferAmount?: number; referenceCode?: string; [key: string]: unknown;
};

const text = (value: unknown) => String(value ?? "").trim();
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export async function matchesCompanySePayApiKey(accountNumber: string, candidate: string) {
  if (!accountNumber || !candidate) return false;
  const companies: any[] = await CompanyModel.find({ "vietqrConfig.accountNo": accountNumber })
    .select("code +vietqrConfig.sepayApiKeyEncrypted")
    .limit(2)
    .lean();
  if (companies.length !== 1) return false;
  const encryptedKey = companies[0]?.vietqrConfig?.sepayApiKeyEncrypted;
  if (!encryptedKey) return false;
  try { return safeEqual(candidate, decryptSecret(encryptedKey)); }
  catch { return false; }
}

export const canonicalPaymentCode = (value: unknown) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
export function retailSePayReviewReason(outsideShift: boolean, receivedAmount: number, appliedAmount: number) {
  if (outsideShift) return "Khoản thu đến sau khi ca bán đã đóng hoặc ngoài phiên.";
  if (receivedAmount > appliedAmount) return "Số tiền nhận vượt số còn phải thu.";
  return undefined;
}
export function retailQrAmount(order: { dueAmount: number; pendingTransferAmount?: number }) {
  return Number(order.pendingTransferAmount) > 0 ? Number(order.pendingTransferAmount) : Number(order.dueAmount);
}
export function parseSePayTransactionDate(value: unknown) {
  const input = text(value);
  if (!input) return new Date();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);
  const normalized = input.replace(" ", "T");
  const parsed = new Date(hasTimezone ? normalized : `${normalized}+07:00`);
  if (Number.isNaN(parsed.getTime())) throw Object.assign(new Error("Ngày giao dịch SePay không hợp lệ."), { status: 400 });
  return parsed;
}

export function sePayTransactionKey(payload: SePayPayload) {
  const id = text(payload.id);
  if (id) return `id:${id}`;
  const reference = text(payload.referenceCode);
  if (reference) return `ref:${reference}`;
  throw Object.assign(new Error("Webhook SePay thiếu id/referenceCode."), { status: 400 });
}

export function extractPaymentCode(payload: SePayPayload) {
  const explicit = canonicalPaymentCode(payload.code);
  if (explicit) return explicit;
  const candidates = (`${text(payload.content)} ${text(payload.description)}`.toUpperCase().match(/[A-Z][A-Z0-9-]{5,}/g) || []).map(canonicalPaymentCode);
  return candidates.find((value) => value.startsWith("AKM"))
    || candidates.find((value) => /\d{12}$/.test(value))
    || "";
}

export async function buildRetailPaymentQr(companyCode: string, branchId: string, orderId: string, access?: { actorId: string; canManage: boolean }) {
  const [company, order] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("vietqrConfig").lean(),
    RetailOrderModel.findOne({ _id: orderId, companyCode, branchId }).lean(),
  ]);
  if (!order || !order.orderCode || order.status === "draft" || order.status === "cancelled") throw new Error("Đơn hàng không thể thanh toán bằng QR.");
  if (access && !access.canManage && String(order.createdBy) !== access.actorId) {
    throw Object.assign(new Error("Bạn không được xem thanh toán của đơn này."), { status: 403 });
  }
  const config = company?.vietqrConfig;
  if (!config?.bankId || !config.accountNo) throw new Error("Doanh nghiệp chưa cấu hình tài khoản VietQR.");
  const paymentCode = text(order.paymentCode) || retailPaymentCode(order.orderCode);
  if (order.paymentCode !== paymentCode) await RetailOrderModel.updateOne({ _id: order._id, companyCode }, { $set: { paymentCode } });
  const transferContent = paymentCode;
  const amount = retailQrAmount(order);
  const params = new URLSearchParams({ acc: config.accountNo, bank: config.bankId, amount: String(amount), des: transferContent });
  return { orderId: String(order._id), orderCode: order.orderCode, paymentCode, transferContent, amount, paymentStatus: order.paymentStatus, accountNumber: config.accountNo, accountName: config.accountName, bankId: config.bankId, qrUrl: `https://vietqr.app/img?${params}` };
}

export async function processRetailSePayTransaction(payload: SePayPayload) {
  if (text(payload.transferType).toLowerCase() !== "in") return { ignored: true, reason: "not_incoming" };
  const receivedAmount = Number(payload.transferAmount || 0);
  if (!Number.isSafeInteger(receivedAmount) || receivedAmount <= 0) throw Object.assign(new Error("Số tiền SePay không hợp lệ."), { status: 400 });
  const accountNumber = text(payload.accountNumber);
  const paymentCode = extractPaymentCode(payload);
  const legacyPaymentCode = paymentCode.startsWith("AKM") ? paymentCode.slice(3) : paymentCode;
  const prefixedPaymentCode = paymentCode.startsWith("AKM") ? paymentCode : `AKM${paymentCode}`;
  const paymentCodeCandidates = [...new Set([paymentCode, legacyPaymentCode, prefixedPaymentCode].filter(Boolean))];
  if (!accountNumber || !paymentCode) throw Object.assign(new Error("Webhook thiếu tài khoản nhận hoặc mã thanh toán."), { status: 400 });
  const companies = await CompanyModel.find({ "vietqrConfig.accountNo": accountNumber }).select("code").limit(2).lean();
  if (companies.length !== 1) throw Object.assign(new Error(companies.length ? "Tài khoản nhận đang được cấu hình cho nhiều doanh nghiệp." : "Không tìm thấy doanh nghiệp theo tài khoản nhận."), { status: companies.length ? 409 : 404 });
  const company = companies[0];
  const transactionId = sePayTransactionKey(payload);
  const prior = await RetailSePayTransactionModel.findOne({ provider: "sepay", transactionId }).lean();
  if (prior) return { duplicate: true, alreadyRecorded: prior.alreadyRecorded === true, orderId: prior.orderId, appliedAmount: prior.appliedAmount };

  const session = await mongoose.startSession();
  let result: any;
  let changedShift: any;
  try {
    await session.withTransaction(async () => {
      changedShift = null;
      const duplicate = await RetailSePayTransactionModel.findOne({ provider: "sepay", transactionId }).session(session).lean();
      if (duplicate) { result = { duplicate: true, alreadyRecorded: duplicate.alreadyRecorded === true, orderId: duplicate.orderId, appliedAmount: duplicate.appliedAmount }; return; }
      const candidateOrders: any[] = await RetailOrderModel.find({ companyCode: company.code, $or: [{ paymentCode: { $in: paymentCodeCandidates } }, { orderCode: text(payload.code) }], status: { $nin: ["draft", "cancelled"] } }).session(session);
      const matches = candidateOrders.filter((candidate) => {
        const orderCode = text(candidate.orderCode);
        return canonicalPaymentCode(candidate.paymentCode) === paymentCode
          || retailPaymentCode(orderCode) === paymentCode
          || legacyRetailPaymentCode(orderCode) === paymentCode
          || orderCode === text(payload.code);
      });
      if (!matches.length) {
        await RetailSePayTransactionModel.create([{ provider: "sepay", transactionId, referenceCode: text(payload.referenceCode), companyCode: company.code, paymentCode, accountNumber, receivedAmount, appliedAmount: 0, transactionDate: parseSePayTransactionDate(payload.transactionDate), status: "pending_review", reviewReason: "Không tìm thấy đơn hàng khớp mã thanh toán." }], { session });
        result = { duplicate: false, appliedAmount: 0, status: "pending_review" };
        return;
      }
      if (matches.length > 1) throw Object.assign(new Error("Mã thanh toán khớp nhiều đơn hàng."), { status: 409 });
      const order: any = matches[0];
      const linkedTransactions: any[] = await RetailSePayTransactionModel.find({ provider: "sepay", companyCode: order.companyCode, orderId: String(order._id) })
        .select("receivedAmount appliedAmount alreadyRecorded")
        .session(session)
        .lean();
      const alreadyAccountedAmount = linkedTransactions.reduce((sum, transaction) => sum + Number(transaction.appliedAmount || 0)
        + (transaction.alreadyRecorded === true ? Number(transaction.receivedAmount || 0) : 0), 0);
      const recordedTransferAmount = (order.payments || []).reduce((sum: number, payment: any) => sum + (payment.method === "transfer" ? Number(payment.amount || 0) : 0), 0);
      const unlinkedRecordedTransferAmount = Math.max(0, recordedTransferAmount - alreadyAccountedAmount);
      if (unlinkedRecordedTransferAmount >= receivedAmount) {
        const paidAt = parseSePayTransactionDate(payload.transactionDate);
        await RetailSePayTransactionModel.create([{ provider: "sepay", transactionId, referenceCode: text(payload.referenceCode), companyCode: order.companyCode, branchId: order.branchId, orderId: String(order._id), orderCode: order.orderCode, accountNumber, receivedAmount, appliedAmount: 0, alreadyRecorded: true, transactionDate: paidAt }], { session });
        result = { duplicate: false, alreadyRecorded: true, orderId: String(order._id), orderCode: order.orderCode, appliedAmount: 0, paymentStatus: order.paymentStatus, status: order.status };
        return;
      }
      if (order.status !== "confirmed" || Number(order.dueAmount) <= 0) {
        throw Object.assign(new Error("Không tìm thấy đơn còn nợ theo mã thanh toán."), { status: 404 });
      }
      const appliedAmount = Math.min(receivedAmount, Number(order.dueAmount));
      const paidAt = parseSePayTransactionDate(payload.transactionDate);
      const recordedAt = new Date();
      const pendingTransferAppliedAmount = Math.min(Number(order.pendingTransferAmount || 0), appliedAmount);
      const debtAppliedAmount = appliedAmount - pendingTransferAppliedAmount;
      order.pendingTransferAmount = Math.max(0, Number(order.pendingTransferAmount || 0) - pendingTransferAppliedAmount);
      changedShift = order.shiftId ? await CashierShiftModel.findOneAndUpdate({ _id: order.shiftId, companyCode: order.companyCode, branchId: order.branchId, status: "open", operationalEndsAt: { $gte: recordedAt }, openedAt: { $lte: paidAt } },
        { $inc: { activityVersion: 1 }, $set: { lastActivityAt: recordedAt } }, { session, returnDocument: "after" }) : null;
      order.payments.push({ method: "transfer", amount: appliedAmount, pendingTransferAppliedAmount, reference: transactionId, paidAt, recordedAt, receivedBy: "sepay", receivedByName: "SePay webhook", shiftId: changedShift ? String(changedShift._id) : undefined, settlementStatus: changedShift ? "assigned" : "unassigned", businessDate: businessDateInVietnam(paidAt) });
      order.paidAmount += appliedAmount; order.dueAmount = order.grandTotal - order.paidAmount;
      order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount);
      if (order.dueAmount === 0) { order.status = "completed"; order.completedAt = paidAt; }
      order.version += 1;
      await order.save({ session });
      if (order.status === "completed") await awardOrderPoints({ companyCode: order.companyCode, branchId: order.branchId }, order, session);
      if (order.retailPartnerId) await reconcileCommission("retail", String(order._id), order.companyCode, session);
      const reviewReason = retailSePayReviewReason(!changedShift, receivedAmount, appliedAmount);
      await RetailSePayTransactionModel.create([{ provider: "sepay", transactionId, referenceCode: text(payload.referenceCode), companyCode: order.companyCode, branchId: order.branchId, orderId: String(order._id), orderCode: order.orderCode, paymentCode, accountNumber, receivedAmount, appliedAmount, transactionDate: paidAt, status: reviewReason ? "pending_review" : "applied", reviewReason }], { session });
      if (debtAppliedAmount > 0 && order.customerId) await publishRetailOrderEvent("paid", { companyCode: order.companyCode, branchId: order.branchId }, order, { id: "sepay", displayName: "SePay webhook" }, { session, amount: debtAppliedAmount, transactionKey: transactionId, occurredAt: paidAt });
      result = { duplicate: false, orderId: String(order._id), orderCode: order.orderCode, appliedAmount, excessAmount: receivedAmount - appliedAmount, paymentStatus: order.paymentStatus, status: order.status };
    });
    const eventOrder: any = result?.orderId
      ? await RetailOrderModel.findById(result.orderId).select("companyCode branchId shiftId salespersonId createdBy").lean()
      : null;
    if (result?.duplicate !== true && result?.alreadyRecorded !== true && result?.paymentStatus === "paid" && eventOrder?.createdBy) {
      emitToUser(String(eventOrder.createdBy), "retail:payment_received", {
        companyCode: String(eventOrder.companyCode),
        branchId: String(eventOrder.branchId),
        orderId: String(result.orderId),
        transactionKey: transactionId,
      });
    }
    if (result?.alreadyRecorded !== true) {
      if (changedShift) emitSessionChange("pos:session:updated", changedShift);
      else if (eventOrder?.shiftId) emitSessionChange("pos:session:updated", { ...eventOrder, _id: eventOrder.shiftId, cashierId: eventOrder.salespersonId });
    }
    return result;
  } finally { await session.endSession(); }
}
