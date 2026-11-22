import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WorkerModel } from "../../models/worker.model";
import { CommissionPolicyModel } from "../models/commission-policy.model";
import { LaborPartnerModel } from "../models/labor-partner.model";
import { LaborPartnerKpiModel } from "../models/partner-kpi.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { LaborPartnerKpiService } from "../services/partner-kpi.service";
import { WorkerReferralService } from "../services/worker-referral.service";

const scope = { companyCode: "KPI-TEST", branchId: "branch-kpi" };
const partnerIds = Object.fromEntries(["An", "Binh", "Dung", "Deleted", "Other branch"].map(name => [name, new mongoose.Types.ObjectId()]));
let replSet: MongoMemoryReplSet;

describe("labor partner KPI service integration", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([LaborPartnerKpiModel.deleteMany({}), WorkerReferralModel.deleteMany({}), LaborPartnerModel.deleteMany({}), WorkerModel.deleteMany({}), CommissionPolicyModel.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  it("counts unique eligible referrals only inside the requested month and returns partners with zero referrals", async () => {
    const makePartner = (name: string, branchId = scope.branchId, deletedAt: Date | null = null) => ({
      _id: partnerIds[name], companyCode: scope.companyCode, branchId, code: name.toUpperCase().replaceAll(" ", "-"),
      name, phone: "0900000000", status: "active" as const, deletedAt,
    });
    await LaborPartnerModel.create([
      makePartner("An"), makePartner("Binh"), makePartner("Dung"), makePartner("Deleted", scope.branchId, new Date()), makePartner("Other branch", "branch-other"),
    ]);
    await LaborPartnerKpiModel.create([
      { companyCode: scope.companyCode, branchId: scope.branchId, partnerId: partnerIds.An, periodStart: "2026-11-01", periodEnd: "2026-12-01", targetReferrals: 3 },
      { companyCode: scope.companyCode, branchId: scope.branchId, partnerId: partnerIds.Binh, periodStart: "2026-11-01", periodEnd: "2026-12-01", targetReferrals: 2 },
      { companyCode: scope.companyCode, branchId: scope.branchId, partnerId: partnerIds.Dung, periodStart: "2026-10-01", periodEnd: "2026-11-01", targetReferrals: 5 },
    ]);

    const policyId = new mongoose.Types.ObjectId();
    const workerIds = ["one", "two", "three", "four", "five", "six"].map(() => new mongoose.Types.ObjectId());
    const referral = (partnerId: mongoose.Types.ObjectId, workerId: mongoose.Types.ObjectId, referredAt: string, status: string, branchId = scope.branchId) => ({
      companyCode: scope.companyCode, branchId, partnerId, workerId, policyId, commissionScheme: "official_monthly",
      referredAt, employmentStartDate: referredAt, effectiveFrom: referredAt, status: status as "active" | "pending" | "ended" | "rejected",
    });
    await WorkerReferralModel.create([
      referral(partnerIds.An, workerIds[0], "2026-11-01", "active"),
      referral(partnerIds.An, workerIds[1], "2026-11-15", "pending"),
      referral(partnerIds.An, workerIds[2], "2026-11-30", "ended"),
      referral(partnerIds.An, workerIds[0], "2026-11-20", "active"), // Same worker does not count twice.
      referral(partnerIds.An, workerIds[3], "2026-11-10", "rejected"),
      referral(partnerIds.An, workerIds[4], "2026-10-31", "active"),
      referral(partnerIds.An, workerIds[5], "2026-12-01", "active"),
      referral(partnerIds.Binh, new mongoose.Types.ObjectId(), "2026-11-06", "active"),
      referral(partnerIds.An, new mongoose.Types.ObjectId(), "2026-11-07", "active", "branch-other"),
      referral(partnerIds["Other branch"], new mongoose.Types.ObjectId(), "2026-11-07", "active", "branch-other"),
    ] as any, { ordered: true });

    const result = await LaborPartnerKpiService.list(scope, "2026-11-20");

    expect(result.periodStart).toBe("2026-11-01");
    expect(result.periodEnd).toBe("2026-12-01");
    expect(result.items.map((item: any) => item.partner.name)).toEqual(["An", "Binh", "Dung"]);
    expect(result.items.map((item: any) => ({ name: item.partner.name, actual: item.actualReferrals, target: item.targetReferrals, remaining: item.remainingReferrals, status: item.status }))).toEqual([
      { name: "An", actual: 3, target: 3, remaining: 0, status: "achieved" },
      { name: "Binh", actual: 1, target: 2, remaining: 1, status: "incomplete" },
      { name: "Dung", actual: 0, target: 0, remaining: null, status: "not_set" },
    ]);
  });

  it("blocks a referral overlapping a closed relationship but allows one after its effective end date", async () => {
    const oldPartnerId = new mongoose.Types.ObjectId();
    const newPartnerId = new mongoose.Types.ObjectId();
    const workerId = new mongoose.Types.ObjectId();
    const policyId = new mongoose.Types.ObjectId();
    await LaborPartnerModel.create([
      { _id: oldPartnerId, companyCode: scope.companyCode, branchId: scope.branchId, code: "OLD", name: "Old partner", phone: "0900000001", status: "active" },
      { _id: newPartnerId, companyCode: scope.companyCode, branchId: scope.branchId, code: "NEW", name: "New partner", phone: "0900000002", status: "active" },
    ]);
    await WorkerModel.create({ _id: workerId, companyCode: scope.companyCode, branchId: scope.branchId, fullName: "Worker A", phone: "0900000003", status: "active", deletedAt: null });
    await CommissionPolicyModel.create({
      _id: policyId, companyCode: scope.companyCode, branchId: scope.branchId, name: "Policy", version: 1,
      effectiveFrom: "2026-01-01", status: "active", settlementCycle: { type: "calendar_month" },
      official: { enabled: true, maxMonths: 1, milestones: [] }, seasonal: { enabled: false, tiers: [] },
      createdBy: { id: "qa", name: "QA", email: "qa@example.test" },
    });
    await WorkerReferralModel.create({
      companyCode: scope.companyCode, branchId: scope.branchId, partnerId: oldPartnerId, workerId, policyId,
      commissionScheme: "official_monthly", referredAt: "2026-01-01", employmentStartDate: "2026-01-01",
      effectiveFrom: "2026-01-01", effectiveTo: "2026-02-28", status: "ended", confirmationSource: "manual",
    });
    const input = (effectiveFrom: string, effectiveTo: string | null) => ({
      workerId: String(workerId), policyId: String(policyId), commissionScheme: "official_monthly",
      referredAt: effectiveFrom, employmentStartDate: effectiveFrom, effectiveFrom, effectiveTo,
      confirmationSource: "manual",
    });

    await expect(WorkerReferralService.create(scope, String(newPartnerId), input("2026-02-15", "2026-03-15")))
      .rejects.toMatchObject({ code: "WORKER_REFERRAL_OVERLAP", status: 409 });
    await expect(WorkerReferralService.create(scope, String(newPartnerId), input("2026-03-01", null)))
      .resolves.toMatchObject({ status: "pending", effectiveFrom: "2026-03-01" });
  });
});
