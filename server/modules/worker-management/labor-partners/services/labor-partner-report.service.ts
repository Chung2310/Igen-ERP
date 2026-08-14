import { requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { LaborPartnerCommissionLineModel } from "../models/commission-line.model";
import { LaborPartnerPayoutModel } from "../models/payout.model";
import { LaborPartnerSettlementModel } from "../models/settlement.model";

type ReportFilters = Record<string, unknown>;

function settlementQuery(scope: LaborPartnerScope, filters: ReportFilters) {
  const query: Record<string, unknown> = { ...scopeQuery(scope) };
  if (filters.partnerId) query.partnerId = requiredObjectId(filters.partnerId);
  if (filters.status) query.status = String(filters.status);
  if (filters.periodFrom) query.periodEnd = { $gte: String(filters.periodFrom) };
  if (filters.periodTo) query.periodStart = { $lte: String(filters.periodTo) };
  return query;
}

export type LaborPartnerReportData = {
  summary: { settlementCount: number; accruedAmount: number; approvedAmount: number; paidAmount: number; balanceAmount: number };
  settlements: any[];
  officialLines: any[];
  seasonalLines: any[];
  adjustmentLines: any[];
  payouts: any[];
  warnings: any[];
};

export class LaborPartnerReportService {
  static async get(scope: LaborPartnerScope, filters: ReportFilters): Promise<LaborPartnerReportData> {
    const settlements = await (LaborPartnerSettlementModel as any).find(settlementQuery(scope, filters))
      .populate("partnerId", "code name")
      .sort({ periodStart: -1, createdAt: -1 })
      .lean();
    const ids = settlements.map((item: any) => item._id);
    if (ids.length === 0) return { summary: { settlementCount: 0, accruedAmount: 0, approvedAmount: 0, paidAmount: 0, balanceAmount: 0 }, settlements: [], officialLines: [], seasonalLines: [], adjustmentLines: [], payouts: [], warnings: [] };

    const lineQuery: Record<string, unknown> = { settlementId: { $in: ids } };
    if (filters.scheme) lineQuery.scheme = String(filters.scheme);
    const [lines, payouts] = await Promise.all([
      (LaborPartnerCommissionLineModel as any).find(lineQuery).populate("workerId", "code fullName phone").sort({ createdAt: 1 }).lean(),
      (LaborPartnerPayoutModel as any).find({ settlementId: { $in: ids }, ...scopeQuery(scope) }).sort({ paidAt: -1, createdAt: -1 }).lean(),
    ]);
    const settlementById = new Map(settlements.map((item: any) => [String(item._id), item]));
    const enrichLine = (line: any) => ({ ...line, settlement: settlementById.get(String(line.settlementId)) });
    const enrichedLines = lines.map(enrichLine);
    const warningRows = settlements.flatMap((settlement: any) => (settlement.warnings || []).map((warning: any) => ({ ...warning, settlementId: settlement._id, periodStart: settlement.periodStart, periodEnd: settlement.periodEnd, partner: settlement.partnerId })));
    const approvedStatuses = new Set(["approved", "partially_paid", "paid"]);
    const nonVoidSettlements = settlements.filter((item: any) => item.status !== "void");

    return {
      summary: {
        settlementCount: settlements.length,
        accruedAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0),
        approvedAmount: settlements.filter((item: any) => approvedStatuses.has(item.status)).reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0),
        paidAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0),
        balanceAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.balanceAmount || 0), 0),
      },
      settlements,
      officialLines: enrichedLines.filter((line: any) => line.scheme === "official_monthly"),
      seasonalLines: enrichedLines.filter((line: any) => line.scheme === "seasonal_hourly"),
      adjustmentLines: enrichedLines.filter((line: any) => line.scheme === "adjustment"),
      payouts,
      warnings: warningRows,
    };
  }
}
