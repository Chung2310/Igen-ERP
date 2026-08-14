import { LaborPartnerModel } from "../models/labor-partner.model";
import { LaborPartnerKpiModel } from "../models/partner-kpi.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { LaborPartnerError, actorSnapshot, requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { resolveSettlementPeriod } from "./calculation/date-cycle";

type KpiInput = { periodAnchor: string; targetReferrals: number; note?: string };

function period(anchor: string) {
  return resolveSettlementPeriod(anchor, { type: "calendar_month" });
}

export const LaborPartnerKpiService = {
  async list(scope: LaborPartnerScope, periodAnchor: string) {
    const current = period(periodAnchor);
    const [partners, targets, referrals] = await Promise.all([
      LaborPartnerModel.find({ ...scopeQuery(scope), deletedAt: null }).sort({ name: 1 }).lean(),
      LaborPartnerKpiModel.find({ ...scopeQuery(scope), periodStart: current.start }).lean(),
      WorkerReferralModel.find({ ...scopeQuery(scope), referredAt: { $gte: current.start, $lt: current.end }, status: { $ne: "rejected" } }).select("partnerId workerId").lean(),
    ]);
    const targetByPartner = new Map(targets.map((item: any) => [String(item.partnerId), item]));
    const workerIdsByPartner = new Map<string, Set<string>>();
    for (const referral of referrals as any[]) {
      const partnerId = String(referral.partnerId);
      const workerIds = workerIdsByPartner.get(partnerId) || new Set<string>();
      workerIds.add(String(referral.workerId));
      workerIdsByPartner.set(partnerId, workerIds);
    }
    return {
      periodStart: current.start,
      periodEnd: current.end,
      items: partners.map((partner: any) => {
        const target = targetByPartner.get(String(partner._id));
        const targetReferrals = Number(target?.targetReferrals || 0);
        const actualReferrals = workerIdsByPartner.get(String(partner._id))?.size || 0;
        return {
          _id: target?._id || null,
          partnerId: partner._id,
          partner: { _id: partner._id, code: partner.code, name: partner.name, status: partner.status },
          periodStart: current.start,
          periodEnd: current.end,
          targetReferrals,
          actualReferrals,
          remainingReferrals: targetReferrals > 0 ? Math.max(targetReferrals - actualReferrals, 0) : null,
          completionRate: targetReferrals > 0 ? Math.round((actualReferrals / targetReferrals) * 10000) / 100 : null,
          status: targetReferrals <= 0 ? "not_set" : actualReferrals >= targetReferrals ? "achieved" : "incomplete",
          note: target?.note || "",
        };
      }),
    };
  },
  async upsert(scope: LaborPartnerScope, partnerId: string, input: KpiInput, actor?: Record<string, unknown>) {
    const partnerObjectId = requiredObjectId(partnerId);
    const partner = await LaborPartnerModel.exists({ _id: partnerObjectId, ...scopeQuery(scope), deletedAt: null });
    if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    const current = period(input.periodAnchor);
    return LaborPartnerKpiModel.findOneAndUpdate(
      { partnerId: partnerObjectId, ...scopeQuery(scope), periodStart: current.start },
      { $set: { periodEnd: current.end, targetReferrals: Number(input.targetReferrals), note: String(input.note || ""), updatedBy: actorSnapshot(actor) }, $setOnInsert: { partnerId: partnerObjectId, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), periodStart: current.start, createdBy: actorSnapshot(actor) } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
  },
};
