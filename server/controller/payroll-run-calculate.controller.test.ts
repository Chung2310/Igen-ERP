import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  snapshotFindOne: vi.fn(),
  adjustmentFind: vi.fn(),
  userFind: vi.fn(),
  contractFind: vi.fn(),
  policyFind: vi.fn(),
  profileFind: vi.fn(),
  dependentFind: vi.fn(),
  revisionFindOne: vi.fn(),
  revisionCreate: vi.fn(),
  revisionFindOneAndUpdate: vi.fn(),
  jobFindOne: vi.fn(),
  jobCreate: vi.fn(),
  auditCreate: vi.fn(),
  formulaFind: vi.fn(),
  periodInputFind: vi.fn(),
  customVariableFind: vi.fn(),
  evaluatePayrollFormulas: vi.fn(),
  lineOverrideFind: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne, findOneAndUpdate: mocks.runFindOneAndUpdate },
}));
vi.mock("../model/payroll-attendance-snapshot.model", () => ({
  PayrollAttendanceSnapshotModel: { findOne: mocks.snapshotFindOne },
}));
vi.mock("../model/payroll-adjustment.model", () => ({
  PayrollAdjustmentModel: { find: mocks.adjustmentFind },
}));
vi.mock("../model/user.model", () => ({ UserModel: { find: mocks.userFind } }));
vi.mock("../model/hr-contract.model", () => ({ HRContractModel: { find: mocks.contractFind } }));
vi.mock("../model/payroll-policy.model", () => ({ PayrollPolicyModel: { find: mocks.policyFind } }));
vi.mock("../model/payroll-profile.model", () => ({
  PayrollProfileModel: { find: mocks.profileFind },
  PayrollDependentModel: { find: mocks.dependentFind },
}));
vi.mock("../model/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: {
    findOne: mocks.revisionFindOne,
    create: mocks.revisionCreate,
    findOneAndUpdate: mocks.revisionFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-operation-job.model", () => ({
  PayrollOperationJobModel: { findOne: mocks.jobFindOne, create: mocks.jobCreate },
}));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));
vi.mock("../model/payroll-formula.model", () => ({ PayrollFormulaModel: { find: mocks.formulaFind } }));
vi.mock("../model/payroll-period-input.model", () => ({ PayrollPeriodInputModel: { find: mocks.periodInputFind } }));
vi.mock("../model/payroll-custom-variable.model", () => ({ PayrollCustomVariableModel: { find: mocks.customVariableFind } }));
vi.mock("../model/payroll-line-override.model", () => ({ PayrollLineOverrideModel: { find: mocks.lineOverrideFind } }));
vi.mock("../service/payroll-formula-engine.service", () => ({ evaluatePayrollFormulas: mocks.evaluatePayrollFormulas }));

import { payrollController } from "./payroll.controller";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLean = <T>(value: T) => ({ select: vi.fn().mockReturnValue(lean(value)) });
const sortSelectLean = <T>(value: T) => ({ sort: vi.fn().mockReturnValue(selectLean(value)) });
const sortLean = <T>(value: T) => ({ sort: vi.fn().mockReturnValue(lean(value)) });
const request = (body: Record<string, unknown>, headers: Record<string, string> = {}, user: any = { id: "actor-a", role: "admin", ...scope }) => ({
  body,
  params: { id: "run-a" },
  headers,
  user,
}) as any;
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const lockedRun = (version = 1, status = "draft") => ({
  _id: "run-a", ...scope, periodKey: "2026-07", status, version,
  startDate: new Date("2026-07-01T00:00:00.000Z"), endDate: new Date("2026-07-31T23:59:59.999Z"),
});

const snapshotEmployees = [{
  employeeId: "employee-a", standardDays: 23, standardHours: 184,
  workedMinutes: 11040, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
}];
const activePolicy = { _id: "policy-default", code: "vn", name: "Việt Nam", status: "active", effectiveFrom: new Date("2026-01-01"), version: 1, baseSalary: 2_340_000, regionalMinimumWage: 4_960_000, socialCapMultiplier: 20, unemploymentCapMultiplier: 20, funds: [], personalDeduction: 11_000_000, dependentDeduction: 4_400_000, taxBrackets: [{ rate: .1 }], shortTermWithholdingRate: .1, shortTermWithholdingThreshold: 2_000_000, nonResidentRate: .2, overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: .3, nightOvertimeBonus: .2 }, roundingUnit: 1 };

const arrangeHappyPath = () => {
  mocks.jobFindOne.mockReturnValue(lean(null));
  mocks.runFindOne.mockReturnValue(lean(lockedRun()));
  mocks.snapshotFindOne.mockReturnValue(lean({ runId: "run-a", employees: snapshotEmployees }));
  mocks.userFind.mockReturnValue(selectLean([{ _id: "employee-a", monthlySalary: 12_000_000 }]));
  mocks.contractFind.mockReturnValue(selectLean([]));
  mocks.policyFind.mockReturnValue(lean([activePolicy]));
  mocks.profileFind.mockReturnValue(lean([]));
  mocks.dependentFind.mockReturnValue(lean([]));
  mocks.adjustmentFind.mockReturnValue(selectLean([
    { employeeId: "employee-a", kind: "allowance", amount: 100_000 },
    { employeeId: "employee-a", kind: "bonus", amount: 200_000 },
    { employeeId: "employee-a", kind: "deduction", amount: 300_000 },
    { employeeId: "employee-a", kind: "correction", amount: 400_000 },
  ]));
  mocks.formulaFind.mockReturnValue(sortLean([]));
  mocks.periodInputFind.mockReturnValue(lean([]));
  mocks.customVariableFind.mockReturnValue(lean([]));
  mocks.lineOverrideFind.mockReturnValue(lean([]));
  mocks.evaluatePayrollFormulas.mockReturnValue({
    applications: [{ code: "operational-formula" }],
    totals: { allowance: 0, bonus: 0, deduction: 0, adjustment: 0 },
  });
  mocks.revisionFindOne.mockReturnValue(sortSelectLean({ revision: 1 }));
  mocks.revisionCreate.mockImplementation(async (value: any) => ({ id: "revision-2", ...value }));
  mocks.revisionFindOneAndUpdate.mockReturnValue(lean({ id: "revision-2", status: "completed", lines: [{ employeeId: "employee-a" }] }));
  mocks.runFindOneAndUpdate.mockReturnValue(lean({ _id: "run-a", status: "draft", version: 2 }));
  mocks.jobCreate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
};

describe("payroll calculate endpoint", () => {
  let readyState: number;

  beforeEach(() => {
    vi.resetAllMocks();
    readyState = mongoose.connection.readyState;
    (mongoose.connection as any).readyState = 1;
  });
  afterEach(() => { (mongoose.connection as any).readyState = readyState; });

  it("calculates every employee of the locked snapshot and activates the new revision", async () => {
    arrangeHappyPath();
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), res);

    expect(mocks.snapshotFindOne).toHaveBeenCalledWith({ ...scope, runId: "run-a" });
    expect(mocks.revisionCreate).toHaveBeenCalledWith(expect.objectContaining({ ...scope, runId: "run-a", revision: 2, status: "running" }));
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, version: 1, status: "draft" },
      { $set: { activeRevisionId: "revision-2", activeRevisionChecksum: expect.stringMatching(/^[0-9a-f]{64}$/) }, $inc: { version: 1 } },
      { new: true },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "calculate", branchId: "branch-a" }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("skips formula-library queries and preserves ordinary adjustments in operational runs", async () => {
    arrangeHappyPath();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), response());

    expect(mocks.formulaFind).not.toHaveBeenCalled();
    expect(mocks.evaluatePayrollFormulas).not.toHaveBeenCalled();
    const line = mocks.revisionFindOneAndUpdate.mock.calls[0][1].$set.lines[0];
    expect(line.formulaApplications).toEqual([]);
    expect(line.calculation).toMatchObject({
      allowances: 100_000, bonuses: 200_000, otherDeductions: 300_000, adjustments: 400_000,
    });
  });

  it("scopes every read to the authenticated company and branch", async () => {
    arrangeHappyPath();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), response());

    expect(mocks.runFindOne).toHaveBeenCalledWith({ _id: "run-a", ...scope });
    expect(mocks.adjustmentFind).toHaveBeenCalledWith(expect.objectContaining({ ...scope, periodKey: "2026-07" }));
    expect(mocks.jobFindOne).toHaveBeenCalledWith(expect.objectContaining({ ...scope, operation: "calculate" }));
  });

  it("loads contracts, profiles, dependents and the active policy for the run employees", async () => {
    arrangeHappyPath();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), response());

    const employeeFilter = { companyCode: "ACME", employeeId: { $in: ["employee-a"] } };
    expect(mocks.contractFind).toHaveBeenCalledWith(employeeFilter);
    expect(mocks.profileFind).toHaveBeenCalledWith(employeeFilter);
    expect(mocks.dependentFind).toHaveBeenCalledWith(employeeFilter);
    expect(mocks.policyFind).toHaveBeenCalledWith({ companyCode: "ACME", status: "active" });
  });

  it("uses the contract salary terms and the active policy when they exist", async () => {
    arrangeHappyPath();
    mocks.contractFind.mockReturnValue(selectLean([{
      _id: "contract-1", employeeId: "employee-a", status: "active",
      startDate: new Date("2025-01-01"), endDate: new Date("2027-01-01"),
      salaryTerms: [{
        salaryEffectiveFrom: new Date("2026-01-01"), contractSalary: 30_000_000,
        insuranceSalary: 20_000_000, payrollSalary: 30_000_000, salaryType: "monthly", currency: "VND",
      }],
    }]));
    mocks.policyFind.mockReturnValue(lean([{
      _id: "policy-1", status: "active", effectiveFrom: new Date("2026-01-01"), version: 2,
      baseSalary: 2_340_000, regionalMinimumWage: 4_960_000, socialCapMultiplier: 20, unemploymentCapMultiplier: 20,
      funds: [{ code: "social", employeeRate: 0.08, employerRate: 0.175, capBasis: "baseSalary" }],
      personalDeduction: 11_000_000, dependentDeduction: 4_400_000,
      taxBrackets: [{ upTo: 5_000_000, rate: 0.05 }, { rate: 0.2 }],
      shortTermWithholdingRate: 0.1, shortTermWithholdingThreshold: 2_000_000, nonResidentRate: 0.2,
      overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2 },
      roundingUnit: 1,
    }]));
    mocks.dependentFind.mockReturnValue(lean([
      { employeeId: "employee-a", status: "verified", deductionFrom: new Date("2026-01-01") },
    ]));

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), response());

    const line = mocks.revisionFindOneAndUpdate.mock.calls[0][1].$set.lines[0];
    expect(line.formulaVersion).toBe("vietnam-payroll-2");
    expect(line.policyId).toBe("policy-1");
    expect(line.calculation.monthlySalary).toBe(30_000_000);
    expect(line.vietnam.insurance.funds[0].base).toBe(20_000_000);
    expect(line.vietnam.tax.deductions.dependents).toBe(4_400_000);
  });

  it("warns instead of failing when an employee has no payroll profile", async () => {
    arrangeHappyPath();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), response());

    const issues = mocks.revisionFindOneAndUpdate.mock.calls[0][1].$set.issues;
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PAYROLL_PROFILE_MISSING", severity: "warning" }),
      expect.objectContaining({ code: "CONTRACT_SALARY_TERM_MISSING", severity: "warning" }),
    ]));
  });

  it("rejects a request without an authenticated branch", async () => {
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }, { id: "actor-a", companyCode: "ACME" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.runFindOne).not.toHaveBeenCalled();
  });

  it("requires an expected version and an idempotency key", async () => {
    const missingVersion = response();
    await payrollController.calculateRun(request({}, { "idempotency-key": "calc-1" }), missingVersion);
    expect(missingVersion.status).toHaveBeenCalledWith(400);

    const missingKey = response();
    await payrollController.calculateRun(request({ expectedVersion: 1 }), missingKey);
    expect(missingKey.status).toHaveBeenCalledWith(400);

    expect(mocks.revisionCreate).not.toHaveBeenCalled();
  });

  it("returns 409 with the current version when the run moved on", async () => {
    mocks.jobFindOne.mockReturnValue(lean(null));
    mocks.runFindOne.mockReturnValue(lean(lockedRun(4)));
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 3 }, { "idempotency-key": "calc-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "error", code: "PAYROLL_VERSION_CONFLICT", currentVersion: 4,
    }));
    expect(mocks.revisionCreate).not.toHaveBeenCalled();
  });

  it("refuses to calculate a run already in review", async () => {
    mocks.jobFindOne.mockReturnValue(lean(null));
    mocks.runFindOne.mockReturnValue(lean(lockedRun(1, "review")));
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_RUN_STATE_INVALID" }));
    expect(mocks.revisionCreate).not.toHaveBeenCalled();
  });

  it("keeps the previous active revision when the snapshot is missing", async () => {
    arrangeHappyPath();
    mocks.snapshotFindOne.mockReturnValue(lean(null));
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_CALCULATION_FAILED" }));
    expect(mocks.revisionFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "revision-2", ...scope },
      { $set: expect.objectContaining({ status: "failed" }) },
      { new: true },
    );
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("replays a retried calculation without creating a second revision", async () => {
    arrangeHappyPath();
    mocks.jobFindOne.mockReturnValue(lean({ runId: "run-a", result: { id: "revision-2", status: "completed" } }));
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), res);

    expect(mocks.revisionCreate).not.toHaveBeenCalled();
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: { revision: { id: "revision-2", status: "completed", lines: [] }, runVersion: 1 },
    });
  });

  it("rejects reusing an idempotency key for a different run", async () => {
    arrangeHappyPath();
    mocks.jobFindOne.mockReturnValue(lean({ runId: "run-b", result: { id: "revision-9" } }));
    const res = response();

    await payrollController.calculateRun(request({ expectedVersion: 1 }, { "idempotency-key": "calc-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_IDEMPOTENCY_CONFLICT" }));
  });
});
