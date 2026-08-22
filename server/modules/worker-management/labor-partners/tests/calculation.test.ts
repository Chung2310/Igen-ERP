import { describe, expect, it } from "vitest";
import { mergeAttendanceIntervals } from "../services/calculation/attendance-interval-merger";
import { calculateOfficialMilestones } from "../services/calculation/official-calculator";
import { calculateSeasonalCommission } from "../services/calculation/seasonal-calculator";

describe("labor partner commission calculation", () => {
  const seasonal = { tiers: [{ minHours: 0, maxHours: 10, hourlyRate: 100 }, { minHours: 10, maxHours: null, hourlyRate: 200 }], hourRounding: { unitMinutes: 1 as const, mode: "nearest" as const }, moneyRounding: { unitVnd: 1, mode: "nearest" as const } };
  it("merges overlapping project intervals before counting minutes", () => {
    const merged = mergeAttendanceIntervals([
      { workerId: "w1", sourceLogId: "a", start: new Date("2026-08-01T01:00:00Z"), end: new Date("2026-08-01T05:00:00Z") },
      { workerId: "w1", sourceLogId: "b", start: new Date("2026-08-01T04:00:00Z"), end: new Date("2026-08-01T08:00:00Z") },
    ]);
    expect(merged).toEqual([{ workerId: "w1", projectId: undefined, minutes: 420, sourceLogIds: ["a", "b"] }]);
  });
  it("uses the configured flat tier for all eligible hours", () => {
    expect(calculateSeasonalCommission(12 * 60, { ...seasonal, tierMode: "flat" })).toMatchObject({ hourlyRate: 200, amount: 2400 });
  });
  it("supports progressive tiers without hard-coded prices", () => {
    expect(calculateSeasonalCommission(12 * 60, { ...seasonal, tierMode: "progressive" })).toMatchObject({ amount: 1400 });
  });
  it("calculates one commission from the partner's aggregate monthly hours", () => {
    const aggregate = { ...seasonal, tierMode: "flat" as const, tiers: [{ minHours: 0, maxHours: null, hourlyRate: 100 }] };
    const totalHours = 150 * 100;
    expect(calculateSeasonalCommission(totalHours * 60, aggregate)).toMatchObject({ eligibleMinutes: totalHours * 60, amount: 1500000 });
  });
  it("does not create an official milestone twice", () => {
    const result = calculateOfficialMilestones({ employmentStartDate: "2026-01-31", periodStart: "2026-02-01", periodEnd: "2026-03-01", milestones: [{ month: 1, amount: 999, eligibilityRule: "contract_active" }], alreadyApprovedMonths: [], isEligible: () => true });
    expect(result).toEqual([{ month: 1, dueDate: "2026-02-28", amount: 999 }]);
    expect(calculateOfficialMilestones({ employmentStartDate: "2026-01-31", periodStart: "2026-02-01", periodEnd: "2026-03-01", milestones: [{ month: 1, amount: 999, eligibilityRule: "contract_active" }], alreadyApprovedMonths: [1], isEligible: () => true })).toEqual([]);
  });
  it("persists multiple commission lines using insertMany with session options", async () => {
    const { LaborPartnerSettlementCalculationService } = await import("../services/settlement-calculation.service");
    const { LaborPartnerModel } = await import("../models/labor-partner.model");
    const { WorkerReferralModel } = await import("../models/worker-referral.model");
    const { LaborPartnerSettlementModel } = await import("../models/settlement.model");
    const { LaborPartnerCommissionLineModel } = await import("../models/commission-line.model");
    const { WorkerAttendanceLogModel } = await import("../../models/worker-attendance-log.model");
    const { WorkerLaborContractModel } = await import("../../models/worker-labor-contract.model");
    const { vi } = await import("vitest");

    const partnerId = "607c24e5a02041968f1a4810";
    const referralId1 = "607c24e5a02041968f1a4811";
    const referralId2 = "607c24e5a02041968f1a4812";
    const workerId1 = "607c24e5a02041968f1a4813";
    const workerId2 = "607c24e5a02041968f1a4814";
    const policyId = "607c24e5a02041968f1a4815";

    const policy = {
      _id: policyId,
      name: "Policy Test",
      status: "active",
      settlementCycle: { type: "calendar_month" },
      official: { enabled: true, maxMonths: 6, milestones: [{ month: 1, amount: 500000, eligibilityRule: "manual_confirmation" }] },
      seasonal: { enabled: false },
    };

    vi.spyOn(LaborPartnerModel, "findOne").mockReturnValue({ lean: async () => ({ _id: partnerId, companyCode: "TEST" }) } as any);
    vi.spyOn(WorkerReferralModel, "find").mockReturnValue({
      populate: () => ({
        lean: async () => [
          { _id: referralId1, workerId: workerId1, commissionScheme: "official_monthly", effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", policyId: policy },
          { _id: referralId2, workerId: workerId2, commissionScheme: "official_monthly", effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", policyId: policy },
        ],
      }),
    } as any);
    vi.spyOn(LaborPartnerSettlementModel as any, "findOne").mockReturnValue({ lean: async () => null });
    vi.spyOn(WorkerAttendanceLogModel, "find").mockReturnValue({ lean: async () => [] } as any);
    vi.spyOn(WorkerLaborContractModel, "find").mockReturnValue({ lean: async () => [] } as any);
    vi.spyOn(LaborPartnerCommissionLineModel as any, "find").mockReturnValue({ select: () => ({ lean: async () => [] }) } as any);

    let createdSettlementDocs: any;
    let createdSettlementOpts: any;
    vi.spyOn(LaborPartnerSettlementModel, "create").mockImplementation((async (docs: any, opts: any) => {
      createdSettlementDocs = docs;
      createdSettlementOpts = opts;
      return [{ _id: "settlement_123", ...docs[0] }];
    }) as any);

    let insertedLineDocs: any;
    let insertedLineOpts: any;
    vi.spyOn(LaborPartnerCommissionLineModel, "insertMany").mockImplementation((async (docs: any, opts: any) => {
      insertedLineDocs = docs;
      insertedLineOpts = opts;
      return docs;
    }) as any);

    const mockSession = { id: "mock-session" };
    const db = await import("../../../../config/database");
    vi.spyOn(db, "runInTransaction").mockImplementation(async (cb: any) => cb(mockSession));

    const result = await LaborPartnerSettlementCalculationService.calculate(
      { companyCode: "TEST" },
      {
        partnerId,
        periodAnchor: "2026-08-01",
        manualEntries: [
          { referralId: referralId1, officialMonths: 1 },
          { referralId: referralId2, officialMonths: 1 },
        ],
      },
      { id: "admin" }
    );

    expect(result.settlement).toBeDefined();
    expect(createdSettlementDocs).toHaveLength(1);
    expect(insertedLineDocs).toHaveLength(2);
    expect(insertedLineOpts).toEqual({ session: mockSession, ordered: true });
    expect(createdSettlementOpts).toEqual({ session: mockSession, ordered: true });
  });
});
