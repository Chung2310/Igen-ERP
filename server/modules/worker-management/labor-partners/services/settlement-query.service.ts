import { requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { LaborPartnerCommissionLineModel } from "../models/commission-line.model";
import { LaborPartnerPayoutModel } from "../models/payout.model";
import { LaborPartnerSettlementModel } from "../models/settlement.model";

export class LaborPartnerSettlementQueryService {
  static async list(scope: LaborPartnerScope, filters: Record<string, unknown>) {
    const query: Record<string, unknown> = { ...scopeQuery(scope) };
    if (filters.partnerId) query.partnerId = requiredObjectId(filters.partnerId);
    if (filters.status) query.status = String(filters.status);
    if (filters.periodStart) query.periodEnd = { $gte: String(filters.periodStart) };
    if (filters.periodEnd) query.periodStart = { $lte: String(filters.periodEnd) };
    if (filters.scheme) {
      const settlementIds = await (LaborPartnerCommissionLineModel as any).distinct("settlementId", { scheme: String(filters.scheme) });
      query._id = { $in: settlementIds };
    }

    return (LaborPartnerSettlementModel as any).find(query)
      .populate("partnerId", "code name")
      .sort({ periodStart: -1, createdAt: -1 })
      .lean();
  }

  static async detail(scope: LaborPartnerScope, settlementId: string) {
    const settlement = await (LaborPartnerSettlementModel as any).findOne({ _id: requiredObjectId(settlementId), ...scopeQuery(scope) })
      .populate("partnerId", "code name")
      .lean();
    if (!settlement) return null;

    const [lines, payouts] = await Promise.all([
      (LaborPartnerCommissionLineModel as any).find({ settlementId: settlement._id }).populate("workerId", "fullName code phone").sort({ scheme: 1, officialMilestone: 1, createdAt: 1 }).lean(),
      (LaborPartnerPayoutModel as any).find({ settlementId: settlement._id, ...scopeQuery(scope) }).sort({ paidAt: -1, createdAt: -1 }).lean(),
    ]);
    return { ...settlement, lines, payouts };
  }
}
