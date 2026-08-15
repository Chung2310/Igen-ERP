import "dotenv/config";
import mongoose from "mongoose";
import { LaborPartnerModel } from "../modules/worker-management/labor-partners/models/labor-partner.model";
import { CommissionPolicyModel } from "../modules/worker-management/labor-partners/models/commission-policy.model";
import { WorkerReferralModel } from "../modules/worker-management/labor-partners/models/worker-referral.model";
import { supportsCommissionScheme } from "../modules/worker-management/labor-partners/services/policy-compatibility";
import { resolveSchemePolicyBackfill } from "../modules/worker-management/labor-partners/services/scheme-policy-backfill";

/**
 * Backfill scheme-specific partner defaults from the legacy defaultPolicyId.
 * Dry-run is the default. Apply only with APPLY_BACKFILL=true.
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const apply = process.env.APPLY_BACKFILL === "true";
  await mongoose.connect(uri);
  let scanned = 0;
  let mapped = 0;
  const counts = { both: 0, official: 0, seasonal: 0, unresolved: 0, unchanged: 0 };
  const unresolved: Array<{ companyCode: string; partnerCode: string; reason: string }> = [];
  const referralMismatches: Array<{ referralId: string; partnerId: string; workerId: string; scheme: string; policyId: string }> = [];

  try {
    const cursor = LaborPartnerModel.find({ deletedAt: null, defaultPolicyId: { $ne: null } }).cursor();
    for await (const partner of cursor) {
      scanned += 1;
      const policy = await CommissionPolicyModel.findOne({
        _id: partner.defaultPolicyId,
        companyCode: partner.companyCode,
        ...(partner.branchId ? { branchId: partner.branchId } : {}),
      }).lean() as any;
      const result = resolveSchemePolicyBackfill(policy, partner);
      counts[result.category] += 1;
      if (result.category === "unresolved") {
        const issue = { companyCode: partner.companyCode, partnerCode: partner.code, reason: result.reason || "unknown" };
        unresolved.push(issue);
        console.log(`[UNRESOLVED] ${partner.companyCode}/${partner.code}: ${issue.reason}`);
        continue;
      }
      const set = result.set as Record<string, mongoose.Types.ObjectId>;
      if (!Object.keys(set).length) continue;

      mapped += 1;
      console.log(`[${apply ? "APPLY" : "DRY-RUN"}] ${partner.companyCode}/${partner.code}: ${Object.keys(set).join(", ")}`);
      if (apply) await LaborPartnerModel.updateOne({ _id: partner._id }, { $set: set });
    }

    const referralCursor = WorkerReferralModel.find({}).populate("policyId", "status official seasonal").cursor();
    for await (const referral of referralCursor) {
      const policy = referral.policyId as any;
      if (!policy || !supportsCommissionScheme(policy, referral.commissionScheme)) {
        referralMismatches.push({
          referralId: String(referral._id),
          partnerId: String(referral.partnerId),
          workerId: String(referral.workerId),
          scheme: referral.commissionScheme,
          policyId: String(policy?._id || referral.policyId || ""),
        });
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.log(JSON.stringify({ apply, scanned, mapped, counts, unresolved, referralMismatches }));
}

main().catch((error) => {
  console.error("Backfill policy theo scheme thất bại:", error);
  process.exit(1);
});
