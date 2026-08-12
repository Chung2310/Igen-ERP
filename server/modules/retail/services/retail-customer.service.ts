import { Types } from "mongoose";
import type { RetailScope, RetailBranchScope } from "../contracts";
import { RetailCustomerCounterModel } from "../models/retail-customer-counter.model";
import { RetailCustomerModel } from "../models/retail-customer.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailCustomerTierHistoryModel } from "../models/retail-customer-tier-history.model";
import { DEFAULT_RETAIL_SETTINGS, getResolvedRetailSettings } from "./retail-settings.service";

type CustomerInput = { name?: unknown; phone?: unknown; email?: unknown; address?: unknown; notes?: unknown; [key: string]: unknown };
type CustomerActor = { id?: unknown; uid?: unknown; displayName?: unknown; email?: unknown };

const optional = (value: unknown) => {
  const parsed = String(value || "").trim();
  return parsed || undefined;
};

export function normalizeCustomerInput(input: CustomerInput) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Tên khách hàng là bắt buộc.");
  const phone = optional(input.phone);
  const normalizedPhone = phone?.replace(/\D/g, "") || undefined;
  return {
    name,
    phone,
    normalizedPhone,
    email: optional(input.email)?.toLowerCase(),
    address: optional(input.address),
    notes: optional(input.notes),
  };
}

export function formatRetailCustomerCode(companyCode: string, seq: number): string {
  return `KH-${companyCode.trim().toUpperCase()}-${String(seq).padStart(6, "0")}`;
}

export function customerCompanyFilter(scope: RetailScope): { companyCode: string } {
  return { companyCode: scope.companyCode };
}

export function resolveCustomerTier(totalSales: number, tiers = DEFAULT_RETAIL_SETTINGS.customerTiers) {
  const spend = Math.max(0, Number(totalSales) || 0);
  return [...tiers].sort((left, right) => left.minSpend - right.minSpend).reduce((selected, tier) => spend >= tier.minSpend ? tier : selected, tiers[0]);
}

const strictDate = (value: unknown, end = false) => {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Ngày hiệu lực hạng không hợp lệ.");
  const parsed = new Date(`${text}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new Error("Ngày hiệu lực hạng không hợp lệ.");
  return parsed;
};

export function normalizeTierOverride(input: any, now = new Date()) {
  const tierCode = String(input.tierCode || "").trim().toLowerCase();
  const reason = String(input.reason || "").trim();
  const effectiveFrom = strictDate(input.effectiveFrom);
  const effectiveTo = strictDate(input.effectiveTo, true);
  if (!tierCode || !reason || reason.length > 500) throw new Error("Hạng và lý do override là bắt buộc.");
  if (effectiveFrom > effectiveTo || effectiveTo < now) throw new Error("Khoảng hiệu lực override không hợp lệ.");
  return { tierCode, reason, effectiveFrom, effectiveTo };
}

export function resolveEffectiveCustomerTier<T extends { code: string; name: string; minSpend: number }>(automatic: T, history: any[], now = new Date()): T {
  const active = history.find((entry) => entry.source === "manual" && new Date(entry.effectiveFrom) <= now && new Date(entry.effectiveTo) >= now);
  return active ? { ...automatic, code: active.toTierCode, name: active.toTierName } : automatic;
}

export function summarizeCustomerTiers(rows: Array<{ tierCode: string; netSales: number; orderCount: number }>) {
  const grouped = new Map<string, { tierCode: string; customers: number; netSales: number; orderCount: number }>();
  for (const row of rows) { const value = grouped.get(row.tierCode) || { tierCode: row.tierCode, customers: 0, netSales: 0, orderCount: 0 }; value.customers += 1; value.netSales += row.netSales; value.orderCount += row.orderCount; grouped.set(row.tierCode, value); }
  return [...grouped.values()].sort((a, b) => a.tierCode.localeCompare(b.tierCode)).map((row) => ({ tierCode: row.tierCode, customerCount: row.customers, netSales: row.netSales, orderCount: row.orderCount, averageOrderFrequency: row.customers ? row.orderCount / row.customers : 0 }));
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildCustomerTierFilterPipeline(scope: RetailBranchScope, tierCode: string, now = new Date()) {
  return [
    { $match: { companyCode: scope.companyCode, branchId: scope.branchId, $or: [{ source: "automatic" }, { source: "manual", effectiveFrom: { $lte: now }, effectiveTo: { $gte: now } }] } },
    { $addFields: { sourcePriority: { $cond: [{ $eq: ["$source", "manual"] }, 1, 0] } } },
    { $sort: { sourcePriority: -1 as const, changedAt: -1 as const } },
    { $group: { _id: "$customerId", tierCode: { $first: "$toTierCode" } } },
    { $match: { tierCode } },
  ];
}

export const RetailCustomerService = {
  async list(scope: RetailScope, query: { q?: unknown; page?: unknown; limit?: unknown; tier?: unknown }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const q = String(query.q || "").trim();
    const filter: Record<string, unknown> = customerCompanyFilter(scope);
    const tierCode = String(query.tier || "").trim().toLowerCase();
    if (tierCode && scope.branchId) {
      const current = await RetailCustomerTierHistoryModel.aggregate(buildCustomerTierFilterPipeline(scope as RetailBranchScope, tierCode));
      filter._id = { $in: current.map((row) => row._id) };
    }
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ customerCode: pattern }, { name: pattern }, { phone: pattern }, { normalizedPhone: pattern }];
    }
    const [items, total] = await Promise.all([
      RetailCustomerModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      RetailCustomerModel.countDocuments(filter),
    ]);
    if (!scope.branchId || items.length === 0) return { items, total, page, limit };
    const customerIds = items.map((customer) => String(customer._id));
    const sales = await RetailOrderModel.aggregate<{ _id: string; totalSales: number }>([
      { $match: { companyCode: scope.companyCode, branchId: scope.branchId, customerId: { $in: customerIds }, status: { $in: ["confirmed", "completed"] } } },
      { $group: { _id: "$customerId", totalSales: { $sum: { $max: [0, { $subtract: ["$grandTotal", "$refundedAmount"] }] } } } },
    ]);
    const settings = await getResolvedRetailSettings({ companyCode: scope.companyCode, branchId: scope.branchId });
    const salesByCustomer = new Map(sales.map((row) => [String(row._id), row.totalSales]));
    return { items: items.map((customer) => ({ ...customer, tier: resolveCustomerTier(salesByCustomer.get(String(customer._id)) || 0, settings.customerTiers) })), total, page, limit };
  },

  async create(scope: RetailBranchScope, input: CustomerInput, actor: CustomerActor) {
    const values = normalizeCustomerInput(input);
    const counter = await RetailCustomerCounterModel.findOneAndUpdate(
      { companyCode: scope.companyCode }, { $inc: { seq: 1 } }, { new: true, upsert: true },
    ).lean();
    return RetailCustomerModel.create({
      ...values,
      customerCode: formatRetailCustomerCode(scope.companyCode, counter!.seq),
      companyCode: scope.companyCode,
      originBranchId: scope.branchId,
      createdBy: String(actor.id || actor.uid || ""),
      createdByName: String(actor.displayName || actor.email || ""),
    });
  },

  async update(scope: RetailScope, id: string, input: CustomerInput) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    const customer = await RetailCustomerModel.findOneAndUpdate(
      { _id: id, ...customerCompanyFilter(scope) }, { $set: normalizeCustomerInput(input) }, { new: true, runValidators: true },
    ).lean();
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    return customer;
  },

  async detail(scope: RetailScope, id: string, transactionBranchId?: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    const customer = await RetailCustomerModel.findOne({ _id: id, ...customerCompanyFilter(scope) }).lean();
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    const orderFilter: Record<string, unknown> = { companyCode: scope.companyCode, customerId: id, status: { $ne: "draft" } };
    if (transactionBranchId) orderFilter.branchId = transactionBranchId;
    const orders = await RetailOrderModel.find(orderFilter).sort({ createdAt: -1 }).lean();
    const valid = orders.filter((order) => order.status !== "cancelled");
    const summary = valid.reduce((acc, order) => ({ totalSales: acc.totalSales + Math.max(0, order.grandTotal - order.refundedAmount), totalCollected: acc.totalCollected + order.paidAmount - order.refundedAmount, currentDebt: acc.currentDebt + order.dueAmount }), { totalSales: 0, totalCollected: 0, currentDebt: 0 });
    const settingsBranchId = transactionBranchId || scope.branchId;
    const tiers = settingsBranchId ? (await getResolvedRetailSettings({ companyCode: scope.companyCode, branchId: settingsBranchId })).customerTiers : DEFAULT_RETAIL_SETTINGS.customerTiers;
    const automaticTier = resolveCustomerTier(summary.totalSales, tiers);
    let tierHistory: unknown[] = [];
    if (settingsBranchId) {
      const historyFilter = { companyCode: scope.companyCode, branchId: settingsBranchId, customerId: id };
      tierHistory = await RetailCustomerTierHistoryModel.find(historyFilter).sort({ changedAt: -1 }).limit(50).lean();
    }
    const tier = resolveEffectiveCustomerTier(automaticTier, tierHistory);
    const payments = orders.flatMap((order: any) => [
      ...(order.payments || []).map((payment: any) => ({ ...payment, orderId: String(order._id), orderCode: order.orderCode, direction: "collection" })),
      ...(order.refunds || []).map((refund: any) => ({ ...refund, orderId: String(order._id), orderCode: order.orderCode, direction: "refund" })),
    ]).sort((a: any, b: any) => new Date(b.paidAt || b.refundedAt).getTime() - new Date(a.paidAt || a.refundedAt).getTime());
    return { customer, summary: { ...summary, tier }, tierHistory, orders, payments };
  },

  async tierHistory(scope: RetailBranchScope, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    return RetailCustomerTierHistoryModel.find({ ...scope, customerId: id }).sort({ changedAt: -1 }).limit(100).lean();
  },

  async overrideTier(scope: RetailBranchScope, id: string, input: any, actor: CustomerActor) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    const customer = await RetailCustomerModel.findOne({ _id: id, companyCode: scope.companyCode }).lean();
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    const values = normalizeTierOverride(input);
    const settings = await getResolvedRetailSettings(scope);
    const tier = settings.customerTiers.find((item) => item.code === values.tierCode);
    if (!tier) throw new Error("Hạng khách hàng không tồn tại.");
    const latest: any = await RetailCustomerTierHistoryModel.findOne({ ...scope, customerId: id }).sort({ changedAt: -1 }).lean();
    return RetailCustomerTierHistoryModel.create({ ...scope, customerId: id, fromTierCode: latest?.toTierCode, fromTierName: latest?.toTierName, toTierCode: tier.code, toTierName: tier.name, totalSales: Number(latest?.totalSales || 0), reason: values.reason, source: "manual", effectiveFrom: values.effectiveFrom, effectiveTo: values.effectiveTo, actorId: String(actor.id || actor.uid || ""), actorName: String(actor.displayName || actor.email || ""), changedAt: new Date() });
  },

  async tierSummary(scope: RetailBranchScope, query: any) {
    const match: any = { ...scope, status: { $in: ["confirmed", "completed"] }, customerId: { $type: "string" } };
    if (query.from || query.to) match.businessDate = { ...(query.from ? { $gte: strictDate(query.from).toISOString().slice(0, 10) } : {}), ...(query.to ? { $lte: strictDate(query.to).toISOString().slice(0, 10) } : {}) };
    const sales = await RetailOrderModel.aggregate([{ $match: match }, { $group: { _id: "$customerId", netSales: { $sum: { $max: [0, { $subtract: ["$grandTotal", "$refundedAmount"] }] } }, orderCount: { $sum: 1 } } }]);
    const settings = await getResolvedRetailSettings(scope);
    const rows = sales.map((row: any) => ({ tierCode: resolveCustomerTier(row.netSales, settings.customerTiers).code, netSales: row.netSales, orderCount: row.orderCount })).filter((row) => !query.tier || row.tierCode === String(query.tier));
    return summarizeCustomerTiers(rows);
  },
};
