import { Types } from "mongoose";
import type { RetailScope, RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailCustomerTierHistoryModel } from "../models/retail-customer-tier-history.model";
import { DEFAULT_RETAIL_SETTINGS, getResolvedRetailSettings } from "./retail-settings.service";
import { getCustomerBrief } from "../../customer-management/contracts";

type CustomerInput = { name?: unknown; phone?: unknown; email?: unknown; address?: unknown; notes?: unknown; [key: string]: unknown };
type CustomerActor = { id?: unknown; uid?: unknown; displayName?: unknown; email?: unknown };

const optional = (value: unknown) => {
  const parsed = String(value || "").trim();
  return parsed || undefined;
};

export function normalizeCustomerInput(input: CustomerInput) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("TÃªn khÃ¡ch hÃ ng lÃ  báº¯t buá»™c.");
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("NgÃ y hiá»‡u lá»±c háº¡ng khÃ´ng há»£p lá»‡.");
  const parsed = new Date(`${text}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new Error("NgÃ y hiá»‡u lá»±c háº¡ng khÃ´ng há»£p lá»‡.");
  return parsed;
};

export function normalizeTierOverride(input: any, now = new Date()) {
  const tierCode = String(input.tierCode || "").trim().toLowerCase();
  const reason = String(input.reason || "").trim();
  const effectiveFrom = strictDate(input.effectiveFrom);
  const effectiveTo = strictDate(input.effectiveTo, true);
  if (!tierCode || !reason || reason.length > 500) throw new Error("Háº¡ng vÃ  lÃ½ do override lÃ  báº¯t buá»™c.");
  if (effectiveFrom > effectiveTo || effectiveTo < now) throw new Error("Khoáº£ng hiá»‡u lá»±c override khÃ´ng há»£p lá»‡.");
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

export function buildCustomerTierFilterPipeline(scope: RetailBranchScope, tierCode: string, now = new Date()) {
  return [
    { $match: { companyCode: scope.companyCode, branchId: scope.branchId, $or: [{ source: "automatic" }, { source: "manual", effectiveFrom: { $lte: now }, effectiveTo: { $gte: now } }] } },
    { $addFields: { sourcePriority: { $cond: [{ $eq: ["$source", "manual"] }, 1, 0] } } },
    { $sort: { sourcePriority: -1 as const, changedAt: -1 as const } },
    { $group: { _id: "$customerId", tierCode: { $first: "$toTierCode" } } },
    { $match: { tierCode } },
  ];
}

export const RetailCustomerTierService = {
  async tierHistory(scope: RetailBranchScope, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("MÃ£ khÃ¡ch hÃ ng khÃ´ng há»£p lá»‡.");
    return RetailCustomerTierHistoryModel.find({ ...scope, customerId: id }).sort({ changedAt: -1 }).limit(100).lean();
  },

  async overrideTier(scope: RetailBranchScope, id: string, input: any, actor: CustomerActor) {
    if (!Types.ObjectId.isValid(id)) throw new Error("MÃ£ khÃ¡ch hÃ ng khÃ´ng há»£p lá»‡.");
    const customer = await getCustomerBrief({ companyCode: scope.companyCode }, id, { includeInactive: true });
    if (!customer) throw new Error("KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng.");
    const values = normalizeTierOverride(input);
    const settings = await getResolvedRetailSettings(scope);
    const tier = settings.customerTiers.find((item) => item.code === values.tierCode);
    if (!tier) throw new Error("Háº¡ng khÃ¡ch hÃ ng khÃ´ng tá»“n táº¡i.");
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
