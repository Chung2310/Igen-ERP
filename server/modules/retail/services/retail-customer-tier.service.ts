import { Types, type ClientSession } from "mongoose";
import { applyCustomerTier, getCustomerTiers } from "../../customer-management/contracts";
import type { RetailBranchScope } from "../contracts";
import type { RetailTierEvaluationWindow } from "../interfaces/retail-settings.interface";
import { RetailCustomerTierHistoryModel } from "../models/retail-customer-tier-history.model";
import { RetailCustomerTierJobModel } from "../models/retail-customer-tier-job.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RepairTicketModel } from "../../repair/repair-ticket.model";
import { CustomerSettingsService } from "../../customer-management/services/customer-settings.service";
import { getResolvedRetailSettings } from "./retail-settings.service";

const day = (value: Date) => value.toISOString().slice(0, 10);

/** Lọc đơn bán lẻ theo chu kỳ đánh giá hạng. */
export function buildTierSalesFilter(companyCode: string, customerId: string, window: RetailTierEvaluationWindow, now: Date) {
  const filter: any = { companyCode, customerId, status: { $in: ["confirmed", "completed"] } };
  if (window.type === "rolling12Months") {
    const from = new Date(now);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    filter.businessDate = { $gte: day(from), $lte: day(now) };
  }
  if (window.type === "custom") {
    filter.businessDate = { $gte: window.from, $lte: window.to };
  }
  return filter;
}

/** Lọc phiếu sửa chữa theo chu kỳ đánh giá hạng (chỉ lấy phiếu done hoặc delivered). */
export function buildTierRepairFilter(companyCode: string, customerId: string, window: RetailTierEvaluationWindow, now: Date) {
  const filter: any = { companyCode, customerId, status: { $in: ["done", "delivered"] } };
  if (window.type === "rolling12Months") {
    const from = new Date(now);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    filter.completedAt = { $gte: from, $lte: now };
  }
  if (window.type === "custom") {
    filter.completedAt = { $gte: new Date(window.from), $lte: new Date(window.to) };
  }
  return filter;
}

/** Tính tổng doanh số net kết hợp từ cả Đơn bán lẻ và Phiếu sửa chữa. */
export function calculateTierNetSales(orders: any[] = [], repairTickets: any[] = []): number {
  const orderSales = orders
    .filter((order) => order.status === "confirmed" || order.status === "completed")
    .reduce((sum, order) => sum + Math.max(0, Number(order.grandTotal || 0) - Number(order.refundedAmount || 0)), 0);

  const repairSales = repairTickets
    .filter((ticket) => ticket.status === "done" || ticket.status === "delivered")
    .reduce((sum, ticket) => sum + Math.max(0, Number(ticket.totalAmount || 0)), 0);

  return orderSales + repairSales;
}

/**
 * Tính tổng LỢI NHUẬN GỘP (Giá bán - Giá vốn) kết hợp từ cả Đơn bán lẻ và Phiếu sửa chữa:
 * - Đơn bán lẻ: grandTotal - refundedAmount - totalCost
 * - Phiếu sửa chữa: totalAmount - partCost (tiền công + chênh lệch linh kiện)
 */
export function calculateTierGrossProfit(orders: any[] = [], repairTickets: any[] = []): number {
  const orderProfit = orders
    .filter((order) => order.status === "confirmed" || order.status === "completed")
    .reduce((sum, order) => {
      const netSales = Math.max(0, Number(order.grandTotal || 0) - Number(order.refundedAmount || 0));
      const cost = Number(order.totalCost || 0);
      return sum + Math.max(0, netSales - cost);
    }, 0);

  const repairProfit = repairTickets
    .filter((ticket) => ticket.status === "done" || ticket.status === "delivered")
    .reduce((sum, ticket) => {
      const revenue = Number(ticket.totalAmount || 0);
      const cost = Number(ticket.partCost || 0);
      return sum + Math.max(0, revenue - cost);
    }, 0);

  return orderProfit + repairProfit;
}

/**
 * Xác định hạng thành viên theo mức đạt được.
 * Hỗ trợ xếp hạng theo Lợi Nhuận Gộp (mặc định) hoặc Doanh số chi tiêu.
 */
export function resolveTier(
  metricValue: number,
  tiers: Array<{ code: string; name: string; minGrossProfit?: number; minSpend?: number }>,
  metricType: "gross_profit" | "sales" = "gross_profit"
) {
  if (!tiers || tiers.length === 0) {
    return { code: "standard", name: "Thành viên", minGrossProfit: 0, minSpend: 0 };
  }

  const sorted = [...tiers].sort((a, b) => {
    const valA = metricType === "sales" ? Number(a.minSpend || 0) : Number(a.minGrossProfit ?? a.minSpend ?? 0);
    const valB = metricType === "sales" ? Number(b.minSpend || 0) : Number(b.minGrossProfit ?? b.minSpend ?? 0);
    return valA - valB;
  });

  return sorted.reduce((selected, tier) => {
    const threshold = metricType === "sales"
      ? Number(tier.minSpend || 0)
      : Number(tier.minGrossProfit ?? tier.minSpend ?? 0);
    return metricValue >= threshold ? tier : selected;
  }, sorted[0]);
}

export async function enqueueTierRefresh(scope: RetailBranchScope, customerId: string, sourceKey: string, session: ClientSession): Promise<void> {
  if (!customerId || !sourceKey || !Types.ObjectId.isValid(customerId)) return;
  await RetailCustomerTierJobModel.updateOne(
    { companyCode: scope.companyCode, sourceKey },
    { $setOnInsert: { ...scope, customerId, sourceKey, status: "pending", attempts: 0 } },
    { upsert: true, session }
  );
}

export async function processTierRefreshJob(jobId: string): Promise<void> {
  if (!Types.ObjectId.isValid(jobId)) throw new Error("Invalid tier refresh job id");
  const job: any = await RetailCustomerTierJobModel.findOneAndUpdate(
    { _id: jobId, status: { $in: ["pending", "failed"] } },
    { $set: { status: "processing" }, $inc: { attempts: 1 }, $unset: { lastError: 1 } },
    { returnDocument: 'after' }
  );
  if (!job) return;

  try {
    const scope = { companyCode: job.companyCode, branchId: job.branchId };
    const [settings, customerSettings, tiers] = await Promise.all([
      getResolvedRetailSettings(scope),
      CustomerSettingsService.getSettings(scope.companyCode),
      getCustomerTiers(scope.companyCode),
    ]);

    const evalWindow = settings.tierEvaluationWindow;
    const now = new Date();

    const [orders, repairTickets] = await Promise.all([
      RetailOrderModel.find(buildTierSalesFilter(scope.companyCode, job.customerId, evalWindow, now))
        .select("status grandTotal totalCost refundedAmount")
        .lean(),
      RepairTicketModel.find(buildTierRepairFilter(scope.companyCode, job.customerId, evalWindow, now))
        .select("status totalAmount partCost")
        .lean(),
    ]);

    const totalSales = calculateTierNetSales(orders, repairTickets);
    const totalGrossProfit = calculateTierGrossProfit(orders, repairTickets);

    const metricType = customerSettings.tierEvaluationMetric || "gross_profit";
    const metricValue = metricType === "sales" ? totalSales : totalGrossProfit;
    const tier = resolveTier(metricValue, tiers, metricType);

    const latest: any = await RetailCustomerTierHistoryModel.findOne({
      companyCode: scope.companyCode,
      customerId: job.customerId,
    }).sort({ changedAt: -1 }).lean();

    if (!latest || latest.toTierCode !== tier.code) {
      await RetailCustomerTierHistoryModel.updateOne(
        { companyCode: scope.companyCode, sourceKey: job.sourceKey },
        {
          $setOnInsert: {
            ...scope,
            customerId: job.customerId,
            fromTierCode: latest?.toTierCode,
            fromTierName: latest?.toTierName,
            toTierCode: tier.code,
            toTierName: tier.name,
            totalSales,
            totalGrossProfit,
            reason: metricType === "gross_profit" ? "automatic-gross-profit-recalculation" : "automatic-sales-recalculation",
            source: "automatic",
            sourceKey: job.sourceKey,
            changedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    await applyCustomerTier(scope.companyCode, job.customerId, tier, totalGrossProfit, totalSales);
    await RetailCustomerTierJobModel.updateOne({ _id: job._id }, { $set: { status: "completed", completedAt: new Date() } });
  } catch (error) {
    await RetailCustomerTierJobModel.updateOne(
      { _id: job._id },
      { $set: { status: "failed", lastError: error instanceof Error ? error.message : String(error) } }
    );
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
    try {
      await processTierRefreshJob(String(job._id));
      processed++;
    } catch (error) {
      failed++;
      console.error("[retail-tier-refresh] job failed", String(job._id), error);
    }
  }
  return { processed, failed };
}

export function startRetailCustomerTierScheduler(intervalMs = 5 * 60 * 1000) {
  const run = () => void processPendingTierRefreshJobs().catch((error) => console.error("[retail-tier-refresh]", error));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
