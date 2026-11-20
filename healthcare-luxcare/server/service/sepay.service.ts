import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import Joi from "joi";
import { getSePayConfig } from "../config/sepay";
import { TransactionModel } from "../model/transaction.model";
import { WalletModel } from "../model/wallet.model";
import { CompanyWalletModel } from "../model/ai-access.model";
import type { BankTransferPayment } from "../../shared/wallet";

export function makeBankTransfer(orderCode: number, amountVND: number, config = getSePayConfig()): BankTransferPayment {
  const paymentCode = `LC${orderCode}`;
  const transferContent = [config.transferNote, paymentCode].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    acc: config.qrAccountNumber, bank: config.bank, amount: String(amountVND),
    des: transferContent, template: "compact", holder: config.accountName,
  });
  return {
    bank: config.bank, accountNumber: config.accountNumber, accountName: config.accountName,
    qrAccountNumber: config.qrAccountNumber, subAccount: config.subAccount,
    amountVND, transferContent, paymentCode, qrUrl: `https://vietqr.app/img?${params}`,
  };
}

export async function createSePayDeposit(userId: string, amountVND: number, payer?: { payerType: "company"; payerId: string }) {
  const config = getSePayConfig();
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = randomInt(10000000, 100000000);
    const bankTransfer = makeBankTransfer(orderCode, amountVND, config);
    const checkoutUrl = payer ? `/company-wallet?orderCode=${orderCode}` : `/vi-nap-tien?orderCode=${orderCode}`;
    try {
      const transaction = await TransactionModel.create({
        userId, ...(payer || {}), orderCode, amount: amountVND / 100, type: "deposit", status: "pending",
        paymentProvider: "sepay", bankTransfer, checkoutUrl,
        description: `Nạp ví chuyển khoản ${bankTransfer.paymentCode}`,
      });
      return { orderCode, amount: transaction.amount, checkoutUrl, paymentLinkId: "", isMock: false,
        paymentProvider: "sepay" as const, bankTransfer };
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }
  throw new Error("Không thể tạo mã nạp tiền. Vui lòng thử lại.");
}

const webhookSchema = Joi.object({
  id: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
  gateway: Joi.string().max(100).required(),
  accountNumber: Joi.string().max(100).required(),
  subAccount: Joi.string().max(100).allow("", null),
  code: Joi.string().max(100).allow("", null),
  content: Joi.string().max(10000).allow("").required(),
  transferType: Joi.string().valid("in", "out").required(),
  transferAmount: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
}).unknown(true).required();

export function parseSePayWebhook(body: unknown) {
  const { value, error } = webhookSchema.validate(body, { convert: false });
  if (error) throw Object.assign(new Error("Dữ liệu webhook không hợp lệ."), { statusCode: 400 });
  return value as { id: number; gateway: string; accountNumber: string; subAccount?: string | null;
    code?: string | null; content: string; transferType: "in" | "out"; transferAmount: number };
}

export function extractPaymentCode(event: ReturnType<typeof parseSePayWebhook>): string | null {
  // Require a complete code, never a substring of another order/reference.
  const codes = new Set((`${event.code || ""} ${event.content}`.toUpperCase().match(/\bLC\d{8}\b/g) || []));
  return codes.size === 1 ? [...codes][0] : null;
}

const normalizeBank = (bank: string) => bank.replace(/\s/g, "").toLowerCase();

export function matchesSePayDeposit(payment: BankTransferPayment | undefined, event: ReturnType<typeof parseSePayWebhook>) {
  return Boolean(payment && event.transferType === "in" && payment.paymentCode === extractPaymentCode(event)
    && payment.accountNumber === event.accountNumber
    && normalizeBank(payment.bank) === normalizeBank(event.gateway)
    && (!payment.subAccount || payment.subAccount === event.subAccount)
    && payment.amountVND === event.transferAmount);
}

export async function receiveSePayTransfer(body: unknown) {
  const event = parseSePayWebhook(body);
  const paymentCode = extractPaymentCode(event);
  if (event.transferType !== "in" || !paymentCode) return "ignored";
  const sepayTransactionId = String(event.id);
  // The unique sparse index plus a MongoDB transaction protect against concurrent retries,
  // reuse of one bank transfer for another order, and partial wallet/ledger writes.
  await TransactionModel.init();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      if (await TransactionModel.exists({ sepayTransactionId }).session(session)) return "duplicate";
      const transaction = await TransactionModel.findOne({
        paymentProvider: "sepay", type: "deposit", status: "pending", "bankTransfer.paymentCode": paymentCode,
      }).session(session);
      if (!transaction || !matchesSePayDeposit(transaction.bankTransfer, event)) return "unmatched";
      const claimed = await TransactionModel.updateOne({ _id: transaction._id, status: "pending" }, {
        $set: { status: "success", completedAt: new Date(), sepayTransactionId },
      }, { session });
      if (claimed.modifiedCount !== 1) return "duplicate";
      if (transaction.payerType === "company" && transaction.payerId) {
        await CompanyWalletModel.updateOne({ companyCode: transaction.payerId }, {
          $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() },
        }, { upsert: true, session });
      } else {
        await WalletModel.updateOne({ userId: transaction.userId }, {
          $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() },
        }, { upsert: true, session });
      }
      return "credited";
    }, { maxCommitTimeMS: 10000 });
  } catch (error: any) {
    if (error?.code === 11000 && await TransactionModel.exists({ sepayTransactionId })) return "duplicate";
    throw error;
  } finally {
    await session.endSession();
  }
}
