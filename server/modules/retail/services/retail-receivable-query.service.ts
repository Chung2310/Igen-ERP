import type { RetailBranchScope } from "../contracts";
import { RetailReceivableEntryModel } from "../models/retail-receivable-entry.model";

const TYPES = ["charge", "payment", "adjustment", "reversal"];
const date = (value: unknown, end = false) => {
  if (value === undefined || value === "") return undefined;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Ngày lọc công nợ không hợp lệ.");
  const parsed = new Date(`${text}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new Error("Ngày lọc công nợ không hợp lệ.");
  return parsed;
};

export function buildRetailReceivableHistoryQuery(scope: RetailBranchScope, customerId: string, query: any) {
  const type = String(query.type || "");
  if (type && !TYPES.includes(type)) throw new Error("Loại bút toán công nợ không hợp lệ.");
  const from = date(query.from);
  const to = date(query.to, true);
  if (from && to && from > to) throw new Error("Khoảng ngày công nợ không hợp lệ.");
  const page = Math.max(1, Number.parseInt(String(query.page || 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit || 20), 10) || 20));
  const filter: any = { ...scope, customerId };
  if (type) filter.type = type;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  return { filter, page, limit, skip: (page - 1) * limit };
}

export function withRunningReceivableBalance<T extends { signedAmount: number }>(newestFirst: T[], openingBalance: number) {
  let balance = openingBalance;
  const chronological = [...newestFirst].reverse().map((entry) => ({ ...entry, runningBalance: balance += entry.signedAmount }));
  return chronological.reverse();
}

export const RetailReceivableQueryService = {
  async history(scope: RetailBranchScope, customerId: string, query: any) {
    const { filter, page, limit, skip } = buildRetailReceivableHistoryQuery(scope, customerId, query);
    const baseFilter = { companyCode: scope.companyCode, branchId: scope.branchId, customerId };
    const [pageItems, total, balanceRows] = await Promise.all([
      RetailReceivableEntryModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      RetailReceivableEntryModel.countDocuments(filter),
      RetailReceivableEntryModel.aggregate([{ $match: baseFilter }, { $group: { _id: null, balance: { $sum: "$signedAmount" } } }]),
    ]);
    const currentBalance = Number(balanceRows[0]?.balance || 0);
    const newest = pageItems[0];
    const newerRows = newest ? await RetailReceivableEntryModel.aggregate([
      { $match: { ...baseFilter, $or: [{ createdAt: { $gt: newest.createdAt } }, { createdAt: newest.createdAt, _id: { $gt: newest._id } }] } },
      { $group: { _id: null, balance: { $sum: "$signedAmount" } } },
    ]) : [];
    let runningBalance = currentBalance - Number(newerRows[0]?.balance || 0);
    const items = pageItems.map((entry) => {
      const item = { ...entry, runningBalance };
      runningBalance -= Number(entry.signedAmount || 0);
      return item;
    });
    return { items, total, page, limit, currentBalance };
  },
};
