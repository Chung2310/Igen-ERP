import { createHash } from "node:crypto";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { RetailCashVoucherModel } from "../models/retail-cash-voucher.model";
import { RetailCashPeriodModel } from "../models/retail-cash-period.model";
import { RetailCommissionPayoutModel } from "../models/retail-commission.model";

export type CashEntry = { sourceKey: string; businessDate: string; account: "cash" | "bank"; direction: "in" | "out"; amount: number; description: string; reference?: string; shiftId?: string };
const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function cashAccount(method: string): "cash" | "bank" { return method === "cash" ? "cash" : "bank"; }
export function assertCashRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || Date.parse(from) > Date.parse(to)) throw bad("Khoảng ngày không hợp lệ.");
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 366) throw bad("Chỉ xem tối đa 366 ngày mỗi lần.");
}
export function projectCashEntries(orders: any[], afterSales: any[], shifts: any[], vouchers: any[], payouts: any[] = []): CashEntry[] {
  const entries: CashEntry[] = [];
  const add = (entry: CashEntry) => { if (Number.isSafeInteger(entry.amount) && entry.amount > 0) entries.push(entry); };
  for (const order of orders) {
    for (const [index, payment] of (order.payments || []).entries()) add({ sourceKey: `order:${order._id}:payment:${index}`, businessDate: payment.businessDate, account: cashAccount(payment.method), direction: "in", amount: payment.amount, description: `Thu đơn ${order.orderCode}`, reference: payment.reference, shiftId: payment.shiftId });
    for (const [index, refund] of (order.refunds || []).entries()) add({ sourceKey: `order:${order._id}:refund:${index}`, businessDate: refund.businessDate, account: cashAccount(refund.method), direction: "out", amount: refund.amount, description: `Hoàn đơn ${order.orderCode}`, reference: refund.reference, shiftId: refund.shiftId });
  }
  const buybackCodes = new Set(afterSales.filter((doc) => doc.type === "buyback").map((doc) => String(doc.code)));
  for (const doc of afterSales) if (doc.type === "buyback") add({ sourceKey: `after-sale:${doc._id}:buyback`, businessDate: doc.businessDate, account: cashAccount(doc.paymentMethod), direction: "out", amount: doc.totalAmount, description: `Thu mua ${doc.code}`, reference: doc.paymentReference, shiftId: doc.shiftId });
  for (const shift of shifts) for (const [index, movement] of (shift.cashMovements || []).entries()) {
    if ([...buybackCodes].some((code) => String(movement.reason).startsWith(`Thu mua ${code}:`))) continue;
    add({ sourceKey: `shift:${shift._id}:movement:${movement.idempotencyKey || index}`, businessDate: shift.businessDate, account: "cash", direction: movement.type, amount: movement.amount, description: movement.reason, shiftId: String(shift._id) });
  }
  for (const voucher of vouchers) add({ sourceKey: voucher.sourceKey, businessDate: voucher.businessDate, account: voucher.account, direction: voucher.direction, amount: voucher.amount, description: voucher.reason, reference: voucher.reference });
  for (const payout of payouts) add({ sourceKey: `commission:payout:${payout._id}`, businessDate: payout.businessDate, account: payout.account || "bank", direction: "out", amount: payout.amount, description: `Chi hoa hồng đối tác ${payout.partnerId}`, reference: payout.reference });
  const unique = new Map<string, CashEntry>();
  for (const entry of entries) { if (unique.has(entry.sourceKey)) throw bad(`Nguồn tiền bị ghi trùng: ${entry.sourceKey}`, 409); unique.set(entry.sourceKey, entry); }
  return [...unique.values()].sort((a, b) => a.businessDate.localeCompare(b.businessDate) || a.sourceKey.localeCompare(b.sourceKey));
}
export function summarizeCash(entries: CashEntry[]) {
  const net = (account: "cash" | "bank") => entries.filter((entry) => entry.account === account).reduce((sum, entry) => sum + entry.amount * (entry.direction === "in" ? 1 : -1), 0);
  const digest = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  return { count: entries.length, cashNet: net("cash"), bankNet: net("bank"), digest };
}
export async function listCashbook(scope: RetailBranchScope, from: string, to: string) {
  assertCashRange(from, to);
  // Payments can be collected after the order date; fetch by embedded payment dates too.
  const [orders, afterSales, shifts, vouchers, payouts] = await Promise.all([
    RetailOrderModel.find({ ...scope, $or: [{ "payments.businessDate": { $gte: from, $lte: to } }, { "refunds.businessDate": { $gte: from, $lte: to } }] }).lean(),
    RetailAfterSaleModel.find({ ...scope, businessDate: { $gte: from, $lte: to }, type: "buyback" }).lean(),
    CashierShiftModel.find({ ...scope, businessDate: { $gte: from, $lte: to } }).lean(),
    RetailCashVoucherModel.find({ ...scope, businessDate: { $gte: from, $lte: to } }).lean(),
    RetailCommissionPayoutModel.find({ ...scope, businessDate: { $gte: from, $lte: to } }).lean(),
  ]);
  const entries = projectCashEntries(orders, afterSales, shifts, vouchers, payouts).filter((entry) => entry.businessDate >= from && entry.businessDate <= to);
  const shiftsReconciliation = shifts.map((shift) => ({ shiftId: String(shift._id), shiftCode: shift.shiftCode, businessDate: shift.businessDate, status: shift.status, expectedCash: Number(shift.expectedCash || 0), countedCash: shift.countedCash === undefined ? null : Number(shift.countedCash), varianceAmount: shift.varianceAmount === undefined ? null : Number(shift.varianceAmount) }));
  return { entries, summary: summarizeCash(entries), shiftsReconciliation };
}
export async function createCashVoucher(scope: RetailBranchScope, input: any, actorId: string) {
  const businessDate = String(input.businessDate || ""), account = String(input.account || ""), direction = String(input.direction || ""), profitCategory = String(input.profitCategory || "other");
  assertCashRange(businessDate, businessDate);
  if (!["cash", "bank"].includes(account) || !["in", "out"].includes(direction) || !["expense", "other"].includes(profitCategory) || (direction === "in" && profitCategory === "expense")) throw bad("Tài khoản, chiều tiền hoặc loại chi phí không hợp lệ.");
  const amount = Number(input.amount), reason = String(input.reason || "").trim(), key = String(input.idempotencyKey || "").trim();
  if (!Number.isSafeInteger(amount) || amount <= 0 || !reason || !key || key.length > 120) throw bad("Phiếu thu chi thiếu số tiền, lý do hoặc khóa yêu cầu hợp lệ.");
  const sourceKey = `voucher:${key}`;
  const closed = await RetailCashPeriodModel.exists({ ...scope, from: { $lte: businessDate }, to: { $gte: businessDate } });
  if (closed) throw bad("Kỳ quỹ đã chốt; không thể ghi phiếu mới.", 409);
  const values = { ...scope, businessDate, account, direction, profitCategory, amount, reason, reference: String(input.reference || "").trim(), sourceKey, createdBy: actorId };
  let voucher: any;
  try { voucher = await RetailCashVoucherModel.findOneAndUpdate({ companyCode: scope.companyCode, sourceKey }, { $setOnInsert: values }, { upsert: true, returnDocument: "after" }).lean(); }
  catch (error: any) { if (error?.code !== 11000) throw error; voucher = await RetailCashVoucherModel.findOne({ companyCode: scope.companyCode, sourceKey }).lean(); }
  if (!voucher || voucher.branchId !== scope.branchId || voucher.businessDate !== businessDate || voucher.account !== account || voucher.direction !== direction || (voucher.profitCategory || "other") !== profitCategory || voucher.amount !== amount || voucher.reason !== reason || (voucher.reference || "") !== values.reference) throw bad("Khóa yêu cầu đã dùng cho phiếu khác.", 409);
  return voucher;
}
export async function closeCashPeriod(scope: RetailBranchScope, from: string, to: string, actorId: string) {
  const { summary } = await listCashbook(scope, from, to);
  const overlap = await RetailCashPeriodModel.exists({ ...scope, from: { $lte: to }, to: { $gte: from } });
  if (overlap) throw bad("Kỳ quỹ đã được chốt hoặc giao nhau với kỳ khác.", 409);
  return RetailCashPeriodModel.create({ ...scope, from, to, ...summary, closedBy: actorId });
}
export async function reconcileCashPeriod(scope: RetailBranchScope, from: string, to: string) {
  const current = await listCashbook(scope, from, to);
  const period = await RetailCashPeriodModel.findOne({ ...scope, from, to }).lean();
  return { ...current, period, balanced: period ? period.digest === current.summary.digest : null };
}
