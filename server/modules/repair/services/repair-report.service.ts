import type { PipelineStage } from "mongoose";
import { RepairFeedbackModel } from "../repair-feedback.model";
import { RepairPartModel } from "../repair-part.model";
import { RepairTicketModel } from "../repair-ticket.model";
import { pausesSla, type RepairStatus } from "../repair-state";

export type RepairReportScope = { companyCode: string; branchId?: string };
export type RepairReportRange = { from: string; to: string };
export type RepairRevenueGroupBy = "branch" | "technician" | "day";

/** Doanh thu chỉ tính trên phiếu đã sửa xong hoặc đã giao, theo mốc hoàn tất. */
const COUNTED_STATUSES: RepairStatus[] = ["done", "delivered"];

function rangeMatch(scope: RepairReportScope, range: RepairReportRange): PipelineStage.Match {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) throw Object.assign(new Error("Khoảng thời gian không hợp lệ."), { statusCode: 400 });
  if (from > to) throw Object.assign(new Error("Ngày bắt đầu phải trước ngày kết thúc."), { statusCode: 400 });
  return { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: { $in: COUNTED_STATUSES }, completedAt: { $gte: from, $lte: to } } };
}

const groupKey: Record<RepairRevenueGroupBy, unknown> = {
  branch: "$branchId",
  technician: { $ifNull: ["$technicianId", ""] },
  day: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
};

export function buildRepairRevenuePipeline(scope: RepairReportScope, range: RepairReportRange, groupBy: RepairRevenueGroupBy = "branch"): PipelineStage[] {
  const isWarranty = { $ne: ["$coverage.costBearer", "customer"] };
  return [
    rangeMatch(scope, range),
    {
      $group: {
        _id: groupKey[groupBy],
        ticketCount: { $sum: 1 },
        warrantyTicketCount: { $sum: { $cond: [isWarranty, 1, 0] } },
        laborRevenue: { $sum: { $ifNull: ["$laborFee", 0] } },
        partRevenue: { $sum: { $ifNull: ["$partRevenue", 0] } },
        revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
        collected: { $sum: { $ifNull: ["$paidAmount", 0] } },
        outstanding: { $sum: { $ifNull: ["$dueAmount", 0] } },
        partCost: { $sum: { $ifNull: ["$partCost", 0] } },
        warrantyPartCost: { $sum: { $cond: [isWarranty, { $ifNull: ["$partCost", 0] }, 0] } },
        branchIds: { $addToSet: "$branchId" },
        technicianName: { $last: "$technicianName" },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
  ];
}

/** Cột giá vốn và lãi gộp là số nhạy cảm — chỉ trả cho người có repair:cost:read. */
function applyCostVisibility(rows: any[], includeCost: boolean) {
  return rows.map(({ _id, branchIds, partCost, warrantyPartCost, ...rest }) => ({
    key: String(_id ?? ""),
    ...(branchIds?.length === 1 ? { branchId: String(branchIds[0]) } : {}),
    ...rest,
    ...(includeCost ? { partCost, warrantyPartCost, grossProfit: Number(rest.revenue || 0) - Number(partCost || 0) } : {}),
  }));
}

export async function repairRevenueReport(scope: RepairReportScope, range: RepairReportRange, options: { groupBy?: RepairRevenueGroupBy; includeCost?: boolean } = {}) {
  const groupBy = options.groupBy || "branch";
  const rows: any[] = await RepairTicketModel.aggregate(buildRepairRevenuePipeline(scope, range, groupBy));
  const items = applyCostVisibility(rows, Boolean(options.includeCost));
  const total = items.reduce((sum, row) => ({
    ticketCount: sum.ticketCount + Number(row.ticketCount || 0),
    warrantyTicketCount: sum.warrantyTicketCount + Number(row.warrantyTicketCount || 0),
    laborRevenue: sum.laborRevenue + Number(row.laborRevenue || 0),
    partRevenue: sum.partRevenue + Number(row.partRevenue || 0),
    revenue: sum.revenue + Number(row.revenue || 0),
    collected: sum.collected + Number(row.collected || 0),
    outstanding: sum.outstanding + Number(row.outstanding || 0),
  }), { ticketCount: 0, warrantyTicketCount: 0, laborRevenue: 0, partRevenue: 0, revenue: 0, collected: 0, outstanding: 0 });
  return { groupBy, range, items, total };
}

export function buildRepairPartUsagePipeline(scope: RepairReportScope, range: RepairReportRange): PipelineStage[] {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  return [
    { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: "issued", issuedAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { branchId: "$branchId", sku: "$sku" },
        productName: { $last: "$productName" },
        quantity: { $sum: "$quantity" },
        warrantyQuantity: { $sum: { $cond: [{ $eq: ["$chargeable", false] }, "$quantity", 0] } },
        cost: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        revenue: { $sum: { $cond: [{ $eq: ["$chargeable", false] }, 0, { $multiply: ["$unitPrice", "$quantity"] }] } },
      },
    },
    { $sort: { quantity: -1 } },
  ];
}

export async function repairPartUsageReport(scope: RepairReportScope, range: RepairReportRange) {
  const rows: any[] = await RepairPartModel.aggregate(buildRepairPartUsagePipeline(scope, range));
  return rows.map(({ _id, ...rest }) => ({ branchId: String(_id.branchId), sku: String(_id.sku), ...rest }));
}

/** Trừ các quãng chờ linh kiện / chờ nhà cung cấp khỏi thời gian sửa — lỗi không thuộc kỹ thuật viên. */
export function activeRepairMinutes(ticket: { receivedAt?: unknown; completedAt?: unknown; statusHistory?: Array<{ to: RepairStatus; at: unknown }> }): number {
  const start = ticket.receivedAt ? new Date(ticket.receivedAt as string).getTime() : NaN;
  const end = ticket.completedAt ? new Date(ticket.completedAt as string).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  let paused = 0;
  let pauseStart: number | undefined;
  for (const entry of ticket.statusHistory || []) {
    const at = new Date(entry.at as string).getTime();
    if (!Number.isFinite(at)) continue;
    if (pausesSla(entry.to)) { pauseStart ??= at; continue; }
    if (pauseStart !== undefined) { paused += Math.max(0, at - pauseStart); pauseStart = undefined; }
  }
  if (pauseStart !== undefined) paused += Math.max(0, end - pauseStart);
  return Math.round(Math.max(0, end - start - paused) / 60_000);
}

export async function repairTechnicianPerformanceReport(scope: RepairReportScope, range: RepairReportRange) {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  const tickets: any[] = await RepairTicketModel.find({
    companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}),
    status: { $in: COUNTED_STATUSES }, completedAt: { $gte: from, $lte: to }, technicianId: { $nin: [null, ""] },
  }).select("technicianId technicianName branchId receivedAt completedAt statusHistory totalAmount").lean();

  const ticketIds = tickets.map((ticket) => String(ticket._id));
  const feedbacks: any[] = await RepairFeedbackModel.find({ companyCode: scope.companyCode, ticketId: { $in: ticketIds } }).lean();
  const feedbackByTicket = new Map(feedbacks.map((item) => [String(item.ticketId), item]));

  const rows = new Map<string, any>();
  for (const ticket of tickets) {
    const key = String(ticket.technicianId);
    const row = rows.get(key) || { technicianId: key, technicianName: String(ticket.technicianName || ""), ticketCount: 0, revenue: 0, totalMinutes: 0, reworkCount: 0, ratingSum: 0, ratingCount: 0, criteria: { skill: 0, attitude: 0, speed: 0 }, criteriaCount: 0 };
    row.ticketCount += 1;
    row.revenue += Number(ticket.totalAmount || 0);
    row.totalMinutes += activeRepairMinutes(ticket);
    // Quay lại "repairing" sau khi đã "done" nghĩa là phải sửa lại.
    row.reworkCount += (ticket.statusHistory || []).filter((entry: any) => entry.from === "done" && entry.to === "repairing").length;
    const feedback = feedbackByTicket.get(String(ticket._id));
    if (feedback) {
      row.ratingSum += Number(feedback.rating || 0);
      row.ratingCount += 1;
      if (feedback.criteria) {
        row.criteria.skill += Number(feedback.criteria.skill || 0);
        row.criteria.attitude += Number(feedback.criteria.attitude || 0);
        row.criteria.speed += Number(feedback.criteria.speed || 0);
        row.criteriaCount += 1;
      }
    }
    rows.set(key, row);
  }

  const round = (value: number, count: number) => (count ? Math.round((value / count) * 10) / 10 : 0);
  return [...rows.values()].map((row) => ({
    technicianId: row.technicianId,
    technicianName: row.technicianName,
    ticketCount: row.ticketCount,
    revenue: row.revenue,
    averageMinutes: row.ticketCount ? Math.round(row.totalMinutes / row.ticketCount) : 0,
    reworkCount: row.reworkCount,
    reworkRate: row.ticketCount ? Math.round((row.reworkCount / row.ticketCount) * 1000) / 10 : 0,
    ratingCount: row.ratingCount,
    averageRating: round(row.ratingSum, row.ratingCount),
    criteria: {
      skill: round(row.criteria.skill, row.criteriaCount),
      attitude: round(row.criteria.attitude, row.criteriaCount),
      speed: round(row.criteria.speed, row.criteriaCount),
    },
  })).sort((a, b) => b.ticketCount - a.ticketCount);
}

export async function repairFeedbackSummaryReport(scope: RepairReportScope, range: RepairReportRange) {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T23:59:59.999Z`);
  const rows: any[] = await RepairFeedbackModel.aggregate([
    { $match: { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), submittedAt: { $gte: from, $lte: to } } },
    { $group: { _id: { branchId: "$branchId", rating: "$rating" }, count: { $sum: 1 } } },
  ]);
  const byBranch = new Map<string, any>();
  for (const row of rows) {
    const branchId = String(row._id.branchId);
    const current = byBranch.get(branchId) || { branchId, count: 0, ratingSum: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    current.count += row.count;
    current.ratingSum += Number(row._id.rating) * row.count;
    current.distribution[row._id.rating] = row.count;
    byBranch.set(branchId, current);
  }
  return [...byBranch.values()].map(({ ratingSum, ...row }) => ({ ...row, averageRating: row.count ? Math.round((ratingSum / row.count) * 10) / 10 : 0 }));
}
