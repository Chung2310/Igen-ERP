import { Types, type ClientSession } from "mongoose";
import { applyCustomerTier, getCustomerTiers } from "../../customer-management/contracts";
import type { RetailBranchScope } from "../contracts";
import type { RetailTierEvaluationWindow } from "../interfaces/retail-settings.interface";
import { RetailCustomerTierHistoryModel } from "../models/retail-customer-tier-history.model";
import { RetailCustomerTierJobModel } from "../models/retail-customer-tier-job.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { getResolvedRetailSettings } from "./retail-settings.service";

const day = (value: Date) => value.toISOString().slice(0, 10);
/** Hạng tính trên toàn công ty: khách mua ở chi nhánh nào cũng cộng vào cùng một mức chi tiêu. */
export function buildTierSalesFilter(companyCode: string, customerId: string, window: RetailTierEvaluationWindow, now: Date) {
  const filter: any = { companyCode, customerId, status: { $in: ["confirmed", "completed"] } };
  if (window.type === "rolling12Months") { const from = new Date(now); from.setUTCFullYear(from.getUTCFullYear() - 1); filter.businessDate = { $gte: day(from), $lte: day(now) }; }
  if (window.type === "custom") filter.businessDate = { $gte: window.from, $lte: window.to };
  return filter;
}
export function calculateTierNetSales(orders: any[]) { return orders.filter((order) => order.status === "confirmed" || order.status === "completed").reduce((sum, order) => sum + Math.max(0, Number(order.grandTotal || 0) - Number(order.refundedAmount || 0)), 0); }
const resolveTier = (sales: number, tiers: Array<{ code: string; name: string; minSpend: number }>) => [...tiers].sort((a, b) => a.minSpend - b.minSpend).reduce((selected, tier) => sales >= tier.minSpend ? tier : selected, tiers[0]);

export async function enqueueTierRefresh(scope: RetailBranchScope, customerId: string, sourceKey: string, session: ClientSession): Promise<void> {
  if (!customerId || !sourceKey) return;
  await RetailCustomerTierJobModel.updateOne({ companyCode: scope.companyCode, sourceKey }, { $setOnInsert: { ...scope, customerId, sourceKey, status: "pending", attempts: 0 } }, { upsert: true, session });
}

export async function processTierRefreshJob(jobId: string): Promise<void> {
  if (!Types.ObjectId.isValid(jobId)) throw new Error("Invalid tier refresh job id");
  const job: any = await RetailCustomerTierJobModel.findOneAndUpdate({ _id: jobId, status: { $in: ["pending", "failed"] } }, { $set: { status: "processing" }, $inc: { attempts: 1 }, $unset: { lastError: 1 } }, { returnDocument: 'after' });
  if (!job) return;
  try {
    const scope = { companyCode: job.companyCode, branchId: job.branchId };
    const [settings, tiers] = await Promise.all([getResolvedRetailSettings(scope), getCustomerTiers(scope.companyCode)]);
    const orders = await RetailOrderModel.find(buildTierSalesFilter(scope.companyCode, job.customerId, settings.tierEvaluationWindow, new Date())).select("status grandTotal refundedAmount").lean();
    const totalSales = calculateTierNetSales(orders);
    const tier = resolveTier(totalSales, tiers);
    const latest: any = await RetailCustomerTierHistoryModel.findOne({ companyCode: scope.companyCode, customerId: job.customerId }).sort({ changedAt: -1 }).lean();
    if (!latest || latest.toTierCode !== tier.code) await RetailCustomerTierHistoryModel.updateOne({ companyCode: scope.companyCode, sourceKey: job.sourceKey }, { $setOnInsert: { ...scope, customerId: job.customerId, fromTierCode: latest?.toTierCode, fromTierName: latest?.toTierName, toTierCode: tier.code, toTierName: tier.name, totalSales, reason: "automatic-sales-recalculation", source: "automatic", sourceKey: job.sourceKey, changedAt: new Date() } }, { upsert: true });
    await applyCustomerTier(scope.companyCode, job.customerId, tier, totalSales);
    await RetailCustomerTierJobModel.updateOne({ _id: job._id }, { $set: { status: "completed", completedAt: new Date() } });
  } catch (error) {
    await RetailCustomerTierJobModel.updateOne({ _id: job._id }, { $set: { status: "failed", lastError: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

export async function processTierRefreshBySourceKey(companyCode: string, sourceKey: string): Promise<void> {
  const job = await RetailCustomerTierJobModel.findOne({ companyCode, sourceKey }).select("_id").lean();
  if (job) await processTierRefreshJob(String(job._id));
}

/** Số lần thử tối đa trước khi bỏ job — tránh vòng lặp vô hạn với lỗi vĩnh viễn. */
export const TIER_JOB_MAX_ATTEMPTS = 5;

/**
 * Quét lại các job xếp hạng chưa xong: job `pending` bị bỏ lại do process restart giữa
 * commit và setImmediate, và job `failed` còn lượt thử.
 */
export async function processPendingTierRefreshJobs(limit = 100): Promise<{ processed: number; failed: number }> {
  const jobs = await RetailCustomerTierJobModel
    .find({ status: { $in: ["pending", "failed"] }, attempts: { $lt: TIER_JOB_MAX_ATTEMPTS } })
    .sort({ createdAt: 1 }).limit(limit).select("_id").lean();
  let processed = 0, failed = 0;
  for (const job of jobs) {
    try { await processTierRefreshJob(String(job._id)); processed++; }
    catch (error) { failed++; console.error("[retail-tier-refresh] job failed", String(job._id), error); }
  }
  return { processed, failed };
}

export function startRetailCustomerTierScheduler(intervalMs = 5 * 60 * 1000) {
  const run = () => void processPendingTierRefreshJobs().catch((error) => console.error("[retail-tier-refresh]", error));
  run(); const timer = setInterval(run, intervalMs); timer.unref?.(); return timer;
}
