import mongoose from "mongoose";
import { CompanyModel } from "../../../model/company.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailSePayTransactionModel } from "../models/retail-sepay-transaction.model";
import { publishRetailOrderEvent } from "./retail-order-events";
import { paymentStatusFor, retailPaymentCode } from "./retail-order.service";

export type SePayPayload = {
  id?: string | number; gateway?: string; transactionDate?: string; accountNumber?: string | number;
  code?: string | null; content?: string; description?: string; transferType?: string;
  transferAmount?: number; referenceCode?: string; [key: string]: unknown;
};

const text = (value: unknown) => String(value ?? "").trim();
export const canonicalPaymentCode = (value: unknown) => text(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
export function parseSePayTransactionDate(value: unknown) {
  const input = text(value);
  if (!input) return new Date();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);
  const parsed = new Date(input.includes(" ") ? `${input.replace(" ", "T")}+07:00` : hasTimezone ? input : `${input}+07:00`);
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
  const candidates = `${text(payload.content)} ${text(payload.description)}`.toUpperCase().match(/[A-Z]{2,5}[A-Z0-9-]{4,30}/g) || [];
  return candidates.map(canonicalPaymentCode).find((value) => value.length >= 6) || "";
}

export async function buildRetailPaymentQr(companyCode: string, orderId: string) {
  const [company, order] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("vietqrConfig").lean(),
    RetailOrderModel.findOne({ _id: orderId, companyCode }).lean(),
  ]);
  if (!order || !order.orderCode || order.status === "draft" || order.status === "cancelled") throw new Error("Đơn hàng không thể thanh toán bằng QR.");
  const config = company?.vietqrConfig;
  if (!config?.bankId || !config.accountNo) throw new Error("Doanh nghiệp chưa cấu hình tài khoản VietQR.");
  const paymentCode = order.paymentCode || retailPaymentCode(order.orderCode);
  if (!order.paymentCode) await RetailOrderModel.updateOne({ _id: order._id, companyCode }, { $set: { paymentCode } });
  const params = new URLSearchParams({ acc: config.accountNo, bank: config.bankId, amount: String(order.dueAmount), des: paymentCode });
  return { orderId: String(order._id), orderCode: order.orderCode, paymentCode, amount: order.dueAmount, paymentStatus: order.paymentStatus, accountNumber: config.accountNo, accountName: config.accountName, bankId: config.bankId, qrUrl: `https://vietqr.app/img?${params}` };
}

export async function processRetailSePayTransaction(payload: SePayPayload) {
  if (text(payload.transferType).toLowerCase() !== "in") return { ignored: true, reason: "not_incoming" };
  const receivedAmount = Number(payload.transferAmount || 0);
  if (!Number.isSafeInteger(receivedAmount) || receivedAmount <= 0) throw Object.assign(new Error("Số tiền SePay không hợp lệ."), { status: 400 });
  const accountNumber = text(payload.accountNumber);
  const paymentCode = extractPaymentCode(payload);
  if (!accountNumber || !paymentCode) throw Object.assign(new Error("Webhook thiếu tài khoản nhận hoặc mã thanh toán."), { status: 400 });
  const companies = await CompanyModel.find({ "vietqrConfig.accountNo": accountNumber }).select("code").limit(2).lean();
  if (companies.length !== 1) throw Object.assign(new Error(companies.length ? "Tài khoản nhận đang được cấu hình cho nhiều doanh nghiệp." : "Không tìm thấy doanh nghiệp theo tài khoản nhận."), { status: companies.length ? 409 : 404 });
  const company = companies[0];
  const transactionId = sePayTransactionKey(payload);
  const prior = await RetailSePayTransactionModel.findOne({ provider: "sepay", transactionId }).lean();
  if (prior) return { duplicate: true, orderId: prior.orderId, appliedAmount: prior.appliedAmount };

  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const duplicate = await RetailSePayTransactionModel.findOne({ provider: "sepay", transactionId }).session(session).lean();
      if (duplicate) { result = { duplicate: true, orderId: duplicate.orderId, appliedAmount: duplicate.appliedAmount }; return; }
      const order: any = await RetailOrderModel.findOne({ companyCode: company.code, $or: [{ paymentCode }, { orderCode: text(payload.code) }], status: "confirmed", dueAmount: { $gt: 0 } }).session(session);
      if (!order) throw Object.assign(new Error("Không tìm thấy đơn còn nợ theo mã thanh toán."), { status: 404 });
      const appliedAmount = Math.min(receivedAmount, Number(order.dueAmount));
      const paidAt = parseSePayTransactionDate(payload.transactionDate);
      order.payments.push({ method: "transfer", amount: appliedAmount, reference: transactionId, paidAt, receivedBy: "sepay", receivedByName: "SePay webhook", shiftId: String(order.shiftId || "sepay"), businessDate: String(order.businessDate || paidAt.toISOString().slice(0, 10)) });
      order.paidAmount += appliedAmount; order.dueAmount = order.grandTotal - order.paidAmount;
      order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount);
      if (order.dueAmount === 0) { order.status = "completed"; order.completedAt = paidAt; }
      order.version += 1;
      await order.save({ session });
      await RetailSePayTransactionModel.create([{ provider: "sepay", transactionId, referenceCode: text(payload.referenceCode), companyCode: order.companyCode, branchId: order.branchId, orderId: String(order._id), orderCode: order.orderCode, accountNumber, receivedAmount, appliedAmount, transactionDate: paidAt }], { session });
      await publishRetailOrderEvent("paid", { companyCode: order.companyCode, branchId: order.branchId }, order, { id: "sepay", displayName: "SePay webhook" }, { session, amount: appliedAmount, transactionKey: transactionId, occurredAt: paidAt });
      result = { duplicate: false, orderId: String(order._id), orderCode: order.orderCode, appliedAmount, excessAmount: receivedAmount - appliedAmount, paymentStatus: order.paymentStatus, status: order.status };
    });
    return result;
  } finally { await session.endSession(); }
}
