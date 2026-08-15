import { describe, expect, it } from "vitest";
import { LaborPartnerModel } from "../models/labor-partner.model";
import { CommissionPolicyModel } from "../models/commission-policy.model";
import { LaborPartnerSettlementModel } from "../models/settlement.model";
import { LaborPartnerPayoutModel } from "../models/payout.model";
import { LaborPartnerKpiModel } from "../models/partner-kpi.model";
import { laborPartnerRoutes } from "../routes/labor-partner.routes";
import { createLaborPartnerSchema } from "../validations/labor-partner.validation";
import { upsertPartnerKpiSchema } from "../validations/partner-kpi.validation";

describe("labor partner persistence and routes", () => {
  it("stores no commission price default on partners", () => {
    expect(LaborPartnerModel.schema.path("commissionValue")).toBeUndefined();
    expect(LaborPartnerModel.schema.path("defaultPolicyId")).toBeTruthy();
    expect(LaborPartnerModel.schema.path("defaultOfficialPolicyId")).toBeTruthy();
    expect(LaborPartnerModel.schema.path("defaultSeasonalPolicyId")).toBeTruthy();
  });
  it("accepts a partner without a default policy", () => {
    const result = createLaborPartnerSchema.validate({ code: "P-001", name: "Đối tác mẫu", phone: "0900000000", defaultPolicyId: "", defaultOfficialPolicyId: "", defaultSeasonalPolicyId: "" });
    expect(result.error).toBeUndefined();
  });
  it("keeps configurable policy values in a versioned policy model", () => {
    expect(CommissionPolicyModel.schema.path("official.milestones.amount")).toBeTruthy();
    expect(CommissionPolicyModel.schema.path("seasonal.tiers.hourlyRate")).toBeTruthy();
    expect(CommissionPolicyModel.schema.path("version")).toBeTruthy();
  });
  it("has settlement and payout idempotency indexes", () => {
    expect(LaborPartnerSettlementModel.schema.indexes().some(([keys, options]) => keys.settlementKey === 1 && keys.revision === 1 && options.unique)).toBe(true);
    expect(LaborPartnerPayoutModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.idempotencyKey === 1 && options.unique)).toBe(true);
  });
  it("stores one monthly KPI target per partner", () => {
    expect(LaborPartnerKpiModel.schema.path("targetReferrals")).toBeTruthy();
    expect(LaborPartnerKpiModel.schema.indexes().some(([keys, options]) => keys.partnerId === 1 && keys.periodStart === 1 && options.unique)).toBe(true);
    expect(upsertPartnerKpiSchema.validate({ periodAnchor: "2026-08-01", targetReferrals: 10 }).error).toBeUndefined();
  });
  it("mounts partner, policy, referral, settlement, and payout endpoints", () => {
    const paths = (laborPartnerRoutes as any).stack.map((layer: any) => layer.route?.path).filter(Boolean);
    expect(paths).toEqual(expect.arrayContaining(["/", "/policies", "/policies/:policyId", "/policies/:policyId/clone", "/kpi", "/kpi/:partnerId", "/:partnerId/referrals", "/dashboard", "/reports/commission", "/reports/commission/export", "/settlements", "/settlements/:settlementId", "/settlements/calculate", "/settlements/:settlementId/recalculate", "/settlements/:settlementId/void", "/settlements/:settlementId/adjustments", "/settlements/:settlementId/approve", "/settlements/:settlementId/payouts", "/payouts/:payoutId/reverse", "/:partnerId/overview"]));
  });
});
