import type { FinanceBranchScope } from "../contracts";
import { RECEIVABLE_STATUSES } from "../interfaces/receivable.interface";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { ReceivableModel } from "../models/receivable.model";

type QueryInput = Record<string, unknown>;

function positiveInteger(value: unknown, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("INVALID_PAGINATION");
  return Math.min(parsed, maximum);
}

function dateBoundary(value: unknown, endOfDay: boolean): Date {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("INVALID_DATE");
  const date = new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) throw new Error("INVALID_DATE");
  return date;
}

export function buildReceivableListQuery(scope: FinanceBranchScope, input: QueryInput = {}) {
  const filter: Record<string, any> = { ...scope };
  if (input.status) {
    const status = String(input.status);
    if (!RECEIVABLE_STATUSES.includes(status as any)) throw new Error("INVALID_STATUS");
    filter.status = status;
  }
  if (input.customerId) filter.customerId = String(input.customerId).trim();
  if (input.agingBucket) {
    const bucket = String(input.agingBucket);
    const ranges: Record<string, Record<string, number>> = {
      "0-30": { $gte: 0, $lte: 30 }, "31-60": { $gte: 31, $lte: 60 },
      "61-90": { $gte: 61, $lte: 90 }, over90: { $gte: 91 },
    };
    if (!ranges[bucket]) throw new Error("INVALID_AGING_BUCKET");
    filter.daysOverdue = ranges[bucket];
  }
  if (input.from || input.to) {
    filter.occurredAt = {};
    if (input.from) filter.occurredAt.$gte = dateBoundary(input.from, false);
    if (input.to) filter.occurredAt.$lte = dateBoundary(input.to, true);
    if (filter.occurredAt.$gte && filter.occurredAt.$lte && filter.occurredAt.$gte > filter.occurredAt.$lte) throw new Error("INVALID_DATE_RANGE");
  }
  const page = positiveInteger(input.page, 1);
  const limit = positiveInteger(input.limit, 20, 100);
  return { filter, page, limit, skip: (page - 1) * limit, sort: { dueDate: 1, _id: 1 } as Record<string, 1 | -1> };
}

export function withRunningReceivableBalance<T extends { amount: number; createdAt: string | Date; _id: unknown }>(entries: T[]) {
  let runningBalance = 0;
  return [...entries]
    .sort((left, right) => new Date(left.createdAt).valueOf() - new Date(right.createdAt).valueOf() || String(left._id).localeCompare(String(right._id)))
    .map((entry) => ({ ...entry, runningBalance: runningBalance += entry.amount }));
}

type AgingBucket = "0-30" | "31-60" | "61-90" | "over90";

export function receivableAgingBuckets(items: Array<{ daysOverdue: number; balance: number }>) {
  const buckets: Record<AgingBucket, { count: number; balance: number }> = {
    "0-30": { count: 0, balance: 0 }, "31-60": { count: 0, balance: 0 },
    "61-90": { count: 0, balance: 0 }, over90: { count: 0, balance: 0 },
  };
  for (const item of items) {
    const key: AgingBucket = item.daysOverdue <= 30 ? "0-30" : item.daysOverdue <= 60 ? "31-60" : item.daysOverdue <= 90 ? "61-90" : "over90";
    buckets[key].count += 1;
    buckets[key].balance += item.balance;
  }
  return buckets;
}

export interface ReceivableQueryRepository {
  list(filter: Record<string, any>, options: { skip: number; limit: number; sort: Record<string, 1 | -1> }): Promise<{ items: any[]; total: number }>;
  detail(filter: Record<string, any>): Promise<{ receivable: any; entries: any[] } | null>;
  aging(filter: Record<string, any>): Promise<any[]>;
  byCustomer(filter: Record<string, any>): Promise<any[]>;
}

export function createReceivableQueryService(repository: ReceivableQueryRepository) {
  return {
    list(scope: FinanceBranchScope, input: QueryInput = {}) {
      const query = buildReceivableListQuery(scope, input);
      return repository.list(query.filter, { skip: query.skip, limit: query.limit, sort: query.sort });
    },
    async detail(scope: FinanceBranchScope, id: string) {
      const result = await repository.detail({ ...scope, _id: id });
      return result ? { ...result, entries: withRunningReceivableBalance(result.entries) } : null;
    },
    async aging(scope: FinanceBranchScope) {
      const items = await repository.aging({ ...scope, status: { $in: ["open", "partially_paid"] }, balance: { $gt: 0 } });
      return receivableAgingBuckets(items);
    },
    byCustomer(scope: FinanceBranchScope, customerId?: string) {
      return repository.byCustomer({ ...scope, ...(customerId ? { customerId } : {}) });
    },
  };
}

const mongooseQueryRepository: ReceivableQueryRepository = {
  async list(filter, options) {
    const [items, total] = await Promise.all([
      ReceivableModel.find(filter).sort(options.sort).skip(options.skip).limit(options.limit).lean(),
      ReceivableModel.countDocuments(filter),
    ]);
    return { items, total };
  },
  async detail(filter) {
    const receivable = await ReceivableModel.findOne(filter).lean();
    if (!receivable) return null;
    const entries = await ReceivableEntryModel.find({ companyCode: filter.companyCode, branchId: filter.branchId, receivableId: String(receivable._id) }).sort({ createdAt: 1, _id: 1 }).lean();
    return { receivable, entries };
  },
  aging: (filter) => ReceivableModel.find(filter).select({ daysOverdue: 1, balance: 1 }).lean(),
  byCustomer: (filter) => ReceivableModel.aggregate([
    { $match: filter },
    { $group: { _id: "$customerId", customerName: { $first: "$customerName" }, balance: { $sum: "$balance" }, originalAmount: { $sum: "$originalAmount" }, count: { $sum: 1 } } },
    { $sort: { balance: -1, _id: 1 } },
  ]),
};

export const ReceivableQueryService = createReceivableQueryService(mongooseQueryRepository);
