import mongoose, { Types, type ClientSession } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RepairTicketModel } from "../../repair/repair-ticket.model";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { RetailCommissionPolicyModel, RetailCommissionBasePolicyModel, RetailProductCommissionModel, RetailCommissionLedgerModel, RetailCommissionPayoutModel, RetailCommissionAccountModel } from "../models/retail-commission.model";
import { RetailCashPeriodModel } from "../models/retail-cash-period.model";
import { assertCashRange } from "./retail-cashbook.service";

const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });
const dateOf = (value?: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value ? new Date(value) : new Date());
export function commissionAmount(baseAmount: number, ratePercent: number) { return Math.round(Math.max(0, baseAmount) * ratePercent / 100); }
async function post(scope: RetailBranchScope, entry: any, session?: ClientSession) {
  const existing = await RetailCommissionLedgerModel.findOne({ companyCode: scope.companyCode, sourceKey: entry.sourceKey }).session(session || null).lean();
  if (existing) return existing;
  const work = async (tx: ClientSession) => {
    const [created] = await RetailCommissionLedgerModel.create([{ ...scope, ...entry }], { session: tx });
    await RetailCommissionAccountModel.updateOne({ companyCode: scope.companyCode, partnerId: entry.partnerId }, { $inc: { balance: entry.amount, version: 1 }, $setOnInsert: { companyCode: scope.companyCode, partnerId: entry.partnerId } }, { upsert: true, session: tx });
    return created;
  };
  if (session) return work(session);
  const tx = await mongoose.startSession();
  try { let result: any; await tx.withTransaction(async () => { result = await work(tx); }); return result; }
  catch (error: any) { if (error?.code === 11000) return RetailCommissionLedgerModel.findOne({ companyCode: scope.companyCode, sourceKey: entry.sourceKey }).lean(); throw error; }
  finally { await tx.endSession(); }
}
async function policyFor(scope: RetailBranchScope, partnerId: string, kind: "sale" | "repair", sku: string, businessDate: string, session?: ClientSession) {
  const endOfDay = new Date(`${businessDate}T23:59:59.999Z`);
  return RetailCommissionPolicyModel.findOne({ companyCode: scope.companyCode, partnerId, kind, sku: { $in: [sku, "*"] }, active: true, $or: [{ effectiveFrom: { $lte: endOfDay } }, { effectiveFrom: { $exists: false } }] }).sort({ sku: -1 }).session(session || null).lean();
}
async function basePolicyFor(scope: RetailBranchScope, partnerId: string, occurredAt: Date, session?: ClientSession) {
  const filter = { companyCode: scope.companyCode, effectiveAt: { $lte: occurredAt } };
  return await RetailCommissionBasePolicyModel.findOne({ ...filter, partnerId }).sort({ effectiveAt: -1 }).session(session || null).lean()
    || await RetailCommissionBasePolicyModel.findOne({ ...filter, partnerId: "" }).sort({ effectiveAt: -1 }).session(session || null).lean();
}
export async function accrueOrderCommission(scope: RetailBranchScope, order: any, session?: ClientSession) {
  if (!order.retailPartnerId || order.status !== "completed") return [];
  const result: any[] = [], subtotal = Number(order.subtotal || 0);
  const occurredAt = order.completedAt ? new Date(order.completedAt) : new Date(`${order.businessDate}T23:59:59.999+07:00`);
  const [basePolicy, productRules] = await Promise.all([
    basePolicyFor(scope, order.retailPartnerId, occurredAt, session),
    RetailProductCommissionModel.find({ companyCode: scope.companyCode, sku: { $in: (order.items || []).map((item: any) => item.sku) } }).session(session || null).lean(),
  ]);
  const productRuleBySku = new Map(productRules.map((item) => [item.sku, item]));
  for (const [index, item] of (order.items || []).entries()) {
    const baseAmount = Math.max(0, Number(item.lineTotal || 0) - (subtotal ? Math.round(Number(order.orderDiscount || 0) * Number(item.lineTotal || 0) / subtotal) : 0));
    const configured = productRuleBySku.get(item.sku);
    const rule = configured?.rule as { kind: "phone" | "accessory"; amount?: number; rateBps?: number } | null | undefined;
    let amount = 0, ratePercent = 0, rateType: "amount" | "percent" = "percent", rateValue = 0, policyId = "";
    if (rule) {
      rateType = rule.kind === "phone" ? "amount" : "percent";
      rateValue = rule.kind === "phone" ? Number(rule.amount) : Number(rule.rateBps) / 100;
      amount = rateType === "amount" ? Number(item.quantity || 0) * rateValue : commissionAmount(baseAmount, rateValue);
      ratePercent = rateType === "amount" ? (baseAmount > 0 ? amount / baseAmount * 100 : 0) : rateValue;
      policyId = String(configured._id);
    } else if (basePolicy) {
      rateType = item.trackingMode === "serial" ? "amount" : "percent";
      rateValue = rateType === "amount" ? basePolicy.config.phoneAmount : basePolicy.config.accessoryBps / 100;
      amount = rateType === "amount" ? Number(item.quantity || 0) * rateValue : commissionAmount(baseAmount, rateValue);
      ratePercent = rateType === "amount" ? (baseAmount > 0 ? amount / baseAmount * 100 : 0) : rateValue;
      policyId = String(basePolicy._id);
    } else {
      const legacyPolicy = await policyFor(scope, order.retailPartnerId, "sale", item.sku, order.businessDate, session);
      if (!legacyPolicy) continue;
      rateValue = legacyPolicy.ratePercent;
      ratePercent = rateValue;
      amount = commissionAmount(baseAmount, ratePercent);
      policyId = String(legacyPolicy._id);
    }
    if (amount <= 0) continue;
    result.push(await post(scope, { partnerId: order.retailPartnerId, sourceKey: `order:${order._id}:line:${index}`, sourceType: "sale", sourceId: String(order._id), sourceCode: order.orderCode, businessDate: order.businessDate, sku: item.sku, amount, baseAmount, ratePercent, rateType, rateValue, policyId }, session));
  }
  return result;
}
export async function reverseOrderCommission(scope: RetailBranchScope, order: any, sourceKey: string, ratioByLine: Map<number, number> | null, session?: ClientSession) {
  const original = await RetailCommissionLedgerModel.find({ companyCode: scope.companyCode, sourceType: "sale", sourceId: String(order._id), amount: { $gt: 0 } }).session(session || null).lean();
  const reversed = await RetailCommissionLedgerModel.find({ companyCode: scope.companyCode, sourceType: "reversal", sourceId: String(order._id) }).session(session || null).lean();
  const result: any[] = [];
  for (const item of original) {
    const index = Number(item.sourceKey.split(":").at(-1));
    const ratio = ratioByLine ? Math.min(1, Math.max(0, ratioByLine.get(index) || 0)) : 1;
    const alreadyReversed = reversed.filter((entry) => entry.sku === item.sku && entry.sourceKey.endsWith(`:line:${index}`)).reduce((sum, entry) => sum - entry.amount, 0);
    const amount = -Math.min(Math.max(0, item.amount - alreadyReversed), Math.round(item.amount * ratio));
    if (!amount) continue;
    result.push(await post(scope, { partnerId: item.partnerId, sourceKey: `${sourceKey}:line:${index}`, sourceType: "reversal", sourceId: String(order._id), sourceCode: order.orderCode, businessDate: dateOf(), sku: item.sku, amount, baseAmount: -Math.round(item.baseAmount * ratio), ratePercent: item.ratePercent, rateType: item.rateType, rateValue: item.rateValue, policyId: item.policyId, reason: sourceKey }, session));
  }
  return result;
}
export async function accrueRepairCommission(scope: RetailBranchScope, ticket: any, session?: ClientSession) {
  if (!ticket.retailPartnerId || ticket.status !== "delivered" || Number(ticket.dueAmount || 0) > 0) return null;
  const basePolicy = await basePolicyFor(scope, ticket.retailPartnerId, ticket.deliveredAt ? new Date(ticket.deliveredAt) : new Date(), session);
  const legacyPolicy = basePolicy ? null : await policyFor(scope, ticket.retailPartnerId, "repair", "*", dateOf(ticket.deliveredAt), session);
  if (!basePolicy && !legacyPolicy) return null;
  const baseAmount = Math.max(0, Number(ticket.laborFee || 0) - Number(ticket.discountAmount || 0));
  const ratePercent = basePolicy ? basePolicy.config.repairBps / 100 : legacyPolicy!.ratePercent;
  const amount = commissionAmount(baseAmount, ratePercent);
  if (!amount) return null;
  return post(scope, { partnerId: ticket.retailPartnerId, sourceKey: `repair:${ticket._id}:labor`, sourceType: "repair", sourceId: String(ticket._id), sourceCode: ticket.ticketCode, businessDate: dateOf(ticket.deliveredAt), sku: "*", amount, baseAmount, ratePercent, rateType: "percent", rateValue: ratePercent, policyId: String((basePolicy || legacyPolicy)!._id) }, session);
}
/** Reverse the original earned commission, without applying today's policy. */
export async function reverseRepairRefundCommission(scope: RetailBranchScope, ticketId: string, cumulativeLaborRefund: number, refundKey: string, businessDate: string, session: ClientSession) {
  const earned = await RetailCommissionLedgerModel.findOne({ ...scope, sourceKey: `repair:${ticketId}:labor`, sourceType: 'repair', sourceId: ticketId }).session(session).lean();
  if (!earned || earned.amount <= 0 || earned.baseAmount <= 0) return null;
  const prior = await RetailCommissionLedgerModel.aggregate<{ amount: number; baseAmount: number }>([
    { $match: { ...scope, sourceType: 'repair-refund', sourceId: ticketId, partnerId: earned.partnerId } },
    { $group: { _id: null, amount: { $sum: '$amount' }, baseAmount: { $sum: '$baseAmount' } } },
  ]).session(session);
  const alreadyReversed = -Number(prior[0]?.amount || 0);
  const entitlement = Math.round(earned.amount * Math.min(cumulativeLaborRefund, earned.baseAmount) / earned.baseAmount);
  const delta = entitlement - alreadyReversed;
  const baseDelta = Math.min(cumulativeLaborRefund, earned.baseAmount) + Number(prior[0]?.baseAmount || 0);
  if (delta < 0 || entitlement > earned.amount || baseDelta < 0 || baseDelta > earned.baseAmount) throw bad('Sổ hoa hồng sửa chữa cần được đối soát trước khi hoàn tiền.', 409);
  if (!delta) return null;
  return post(scope, { partnerId: earned.partnerId, sourceKey: `repair:${ticketId}:refund:${refundKey}`, sourceType: 'repair-refund', sourceId: ticketId, sourceCode: earned.sourceCode, businessDate, sku: earned.sku, amount: -delta, baseAmount: -baseDelta, ratePercent: earned.ratePercent, rateType: earned.rateType, rateValue: earned.rateValue, policyId: earned.policyId, reason: 'Thu hồi hoa hồng theo khoản hoàn tiền công sửa chữa' }, session);
}

export async function reconcilePartnerCommission(scope: RetailBranchScope, partnerId: string) {
  const partner = await RetailPartnerModel.findOne({ companyCode: scope.companyCode, _id: partnerId, roles: "collaborator" }).lean();
  if (!partner) throw bad("Không tìm thấy cộng tác viên bán lẻ.", 404);
  const orders = await RetailOrderModel.find({ ...scope, retailPartnerId: partnerId, status: "completed" }).lean();
  for (const order of orders) await accrueOrderCommission(scope, order);
  const returns = await RetailAfterSaleModel.find({ ...scope, type: "return", orderId: { $in: orders.map((order) => String(order._id)) } }).lean();
  const byOrder = new Map(orders.map((order) => [String(order._id), order]));
  for (const doc of returns) { const order = byOrder.get(doc.orderId); if (!order) continue; const ratios = new Map<number, number>(); for (const item of doc.items || []) ratios.set(item.orderLineIndex, (ratios.get(item.orderLineIndex) || 0) + item.quantity / Number(order.items[item.orderLineIndex]?.quantity || 1)); await reverseOrderCommission(scope, order, `return:${doc._id}`, ratios); }
  const tickets = await RepairTicketModel.find({ ...scope, retailPartnerId: partnerId, status: "delivered" }).lean();
  for (const ticket of tickets) await accrueRepairCommission(scope, ticket);
  return { orders: orders.length, returns: returns.length, repairs: tickets.length };
}
export async function partnerStatement(companyCode: string, partnerId: string, from: string, to: string) {
  assertCashRange(from, to);
  const [entries, payouts, account] = await Promise.all([
    RetailCommissionLedgerModel.find({ companyCode, partnerId, businessDate: { $gte: from, $lte: to } }).sort({ businessDate: 1, createdAt: 1 }).lean(),
    RetailCommissionPayoutModel.find({ companyCode, partnerId, businessDate: { $gte: from, $lte: to } }).sort({ createdAt: 1 }).lean(),
    RetailCommissionAccountModel.findOne({ companyCode, partnerId }).lean(),
  ]);
  return { entries, payouts, balance: account?.balance || 0, earned: entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0), reversed: entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum - entry.amount, 0), paid: payouts.reduce((sum, item) => sum + item.amount, 0) };
}
export async function payPartnerCommission(scope: RetailBranchScope, partnerId: string, input: any, actorId: string) {
  if (!Types.ObjectId.isValid(partnerId) || !await RetailPartnerModel.exists({ companyCode: scope.companyCode, _id: partnerId, roles: "collaborator" })) throw bad("Cộng tác viên bán lẻ không hợp lệ.");
  const amount = Number(input.amount), key = String(input.idempotencyKey || "").trim(), reference = String(input.reference || "").trim(), businessDate = String(input.businessDate || ""), account = String(input.account || "bank");
  assertCashRange(businessDate, businessDate);
  if (await RetailCashPeriodModel.exists({ ...scope, from: { $lte: businessDate }, to: { $gte: businessDate } })) throw bad("Kỳ quỹ đã chốt; không thể ghi chi trả.", 409);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !key || !reference || !["cash", "bank"].includes(account)) throw bad("Thiếu số tiền, mã giao dịch, tài khoản chi hoặc khóa yêu cầu.");
  const replay = await RetailCommissionPayoutModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean();
  if (replay) { if (replay.partnerId !== partnerId || replay.amount !== amount || replay.reference !== reference || replay.account !== account || replay.businessDate !== businessDate || replay.branchId !== scope.branchId) throw bad("Khóa yêu cầu đã dùng cho chi trả khác.", 409); return replay; }
  const session = await mongoose.startSession();
  try { let result: any; await session.withTransaction(async () => {
    const updated = await RetailCommissionAccountModel.updateOne({ companyCode: scope.companyCode, partnerId, balance: { $gte: amount } }, { $inc: { balance: -amount, version: 1 } }, { session });
    if (updated.modifiedCount !== 1) throw bad("Số dư hoa hồng không đủ.", 409);
    [result] = await RetailCommissionPayoutModel.create([{ ...scope, partnerId, amount, account: account as "cash" | "bank", idempotencyKey: key, reference, businessDate, createdBy: actorId }], { session });
  }); return result; }
  catch (error: any) { if (error?.code === 11000) { const prior = await RetailCommissionPayoutModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean(); if (prior && prior.partnerId === partnerId && prior.branchId === scope.branchId && prior.amount === amount && prior.reference === reference && prior.account === account && prior.businessDate === businessDate) return prior; throw bad("Khóa yêu cầu đã dùng cho chi trả khác.", 409); } throw error; }
  finally { await session.endSession(); }
}
