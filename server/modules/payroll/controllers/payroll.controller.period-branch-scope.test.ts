import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runCreate: vi.fn(),
  companyFindOne: vi.fn(),
  timekeepingFind: vi.fn(),
  leaveFind: vi.fn(),
  calendarFind: vi.fn(),
  attendanceFindOneAndUpdate: vi.fn(),
  attendanceFind: vi.fn(),
  attendanceExists: vi.fn(),
  attendanceUpdateMany: vi.fn(),
  auditFind: vi.fn(),
  auditCreate: vi.fn(),
  policyFind: vi.fn(),
  profileFind: vi.fn(),
  dependentFind: vi.fn(),
  adjustmentFind: vi.fn(),
  formulaFind: vi.fn(),
  periodInputFind: vi.fn(),
  customVariableFind: vi.fn(),
  evaluatePayrollFormulas: vi.fn(),
  lineOverrideFind: vi.fn(),
  publicationFind: vi.fn(),
  revisionFindOne: vi.fn(),
  repairSnapshot: vi.fn(),
}));

vi.mock("../models/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne, create: mocks.runCreate },
}));
vi.mock("../models/payroll-policy.model", () => ({ PayrollPolicyModel: { find: mocks.policyFind } }));
vi.mock("../models/payroll-profile.model", () => ({
  PayrollProfileModel: { find: mocks.profileFind },
  PayrollDependentModel: { find: mocks.dependentFind },
}));
vi.mock("../models/payroll-adjustment.model", () => ({ PayrollAdjustmentModel: { find: mocks.adjustmentFind } }));
vi.mock("../models/payroll-formula.model", () => ({ PayrollFormulaModel: { find: mocks.formulaFind } }));
vi.mock("../models/payroll-period-input.model", () => ({ PayrollPeriodInputModel: { find: mocks.periodInputFind } }));
vi.mock("../models/payroll-custom-variable.model", () => ({ PayrollCustomVariableModel: { find: mocks.customVariableFind } }));
vi.mock("../models/payroll-line-override.model", () => ({ PayrollLineOverrideModel: { find: mocks.lineOverrideFind } }));
vi.mock("../../../model/payslip-publication.model", () => ({ PayslipPublicationModel: { find: mocks.publicationFind } }));
vi.mock("../models/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));
vi.mock("../services/payroll-formula-engine.service", () => ({ evaluatePayrollFormulas: mocks.evaluatePayrollFormulas }));
vi.mock("../services/payroll-effective-snapshot-repair.service", () => ({
  repairReviewEffectivePayrollSnapshot: mocks.repairSnapshot,
}));
vi.mock("../../../model/company.model", () => ({
  CompanyModel: { findOne: mocks.companyFindOne },
}));
vi.mock("../../../model/timekeeping.model", () => ({
  TimekeepingLogModel: { find: mocks.timekeepingFind },
}));
vi.mock("../../../model/hr-leave-application.model", () => ({
  HRLeaveApplicationModel: { find: mocks.leaveFind },
}));
vi.mock("../../../model/company-work-calendar.model", () => ({
  CompanyWorkCalendarDayModel: { find: mocks.calendarFind },
}));
vi.mock("../../../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: {
    findOneAndUpdate: mocks.attendanceFindOneAndUpdate,
    find: mocks.attendanceFind,
    exists: mocks.attendanceExists,
    updateMany: mocks.attendanceUpdateMany,
  },
}));
vi.mock("../models/payroll-audit.model", () => ({
  PayrollAuditModel: { find: mocks.auditFind, create: mocks.auditCreate },
}));

import { payrollController } from "./index";
import { DEFAULT_VIETNAM_PAYROLL_POLICY } from "../config/payroll-default-policy";
import { calculatePayrollChecksum } from "../services/payroll-checksum.service";
import { createPayrollEffectiveLineLoader } from "../services/payroll-effective-line.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const branchRequest = (overrides: Record<string, unknown> = {}) => ({
  user: { id: "actor-a", role: "superadmin", companyCode: "ACME", branchId: "branch-a" },
  params: { periodKey: "2026-07" },
  body: { employees: [{ employeeId: "employee-a", monthlySalary: 1000 }] },
  ...overrides,
}) as any;
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const sortedLean = <T>(value: T) => ({
  sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
});

describe("legacy payroll period branch scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.runFindOne.mockReturnValue(sortedLean(null));
    mocks.companyFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue(lean({ locationConfig: { workingDays: [1, 2, 3, 4, 5] } })),
    });
    mocks.timekeepingFind.mockReturnValue(lean([]));
    mocks.leaveFind.mockReturnValue(lean([]));
    mocks.calendarFind.mockReturnValue(lean([]));
    mocks.attendanceFindOneAndUpdate.mockResolvedValue({ _id: "result-a" });
    mocks.attendanceFind.mockReturnValue(lean([{ _id: "result-a" }]));
    mocks.attendanceExists.mockResolvedValue(false);
    mocks.attendanceUpdateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.auditFind.mockReturnValue({ sort: vi.fn().mockReturnValue(lean([{ _id: "audit-a" }])) });
    mocks.auditCreate.mockResolvedValue({});
    mocks.policyFind.mockReturnValue(lean([DEFAULT_VIETNAM_PAYROLL_POLICY]));
    mocks.profileFind.mockReturnValue(lean([]));
    mocks.dependentFind.mockReturnValue(lean([]));
    mocks.adjustmentFind.mockReturnValue(lean([]));
    mocks.formulaFind.mockReturnValue(sortedLean([]));
    mocks.evaluatePayrollFormulas.mockReturnValue({
      applications: [{ code: "legacy-formula" }],
      totals: { allowance: 0, bonus: 0, deduction: 0, adjustment: 0 },
    });
    mocks.periodInputFind.mockReturnValue(lean([]));
    mocks.customVariableFind.mockReturnValue(lean([]));
    mocks.lineOverrideFind.mockReturnValue(lean([]));
    mocks.publicationFind.mockReturnValue({ select: vi.fn().mockReturnValue(lean([])) });
    mocks.revisionFindOne.mockReturnValue(lean(null));
  });

  it("scopes snapshot source reads and attendance upserts to the authenticated branch", async () => {
    const res = response();

    await payrollController.createSnapshot(branchRequest(), res);

    expect(mocks.timekeepingFind).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", branchId: { $in: ["branch-a", null, undefined] },
    }));
    expect(mocks.leaveFind).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", branchId: { $in: ["branch-a", null, undefined] }, status: "approved",
    }));
    expect(mocks.attendanceFindOneAndUpdate).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", employeeId: "employee-a" },
      expect.objectContaining({ $set: expect.objectContaining({ branchId: "branch-a" }) }),
      expect.objectContaining({ upsert: true }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("blocks snapshot attendance rewrites after the deterministic regular run is closed", async () => {
    mocks.runFindOne.mockReturnValue(sortedLean({ _id: "closed-a", status: "closed" }));
    const res = response();

    await payrollController.createSnapshot(branchRequest(), res);

    expect(mocks.runFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", type: "regular",
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.timekeepingFind).not.toHaveBeenCalled();
    expect(mocks.attendanceFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("normalizes timekeeping log dates before evaluating payroll working days", async () => {
    mocks.companyFindOne.mockReturnValue({
      select: vi.fn().mockReturnValue(lean({ locationConfig: { workingDays: [1, 2, 3, 4, 5, 6] } })),
    });
    mocks.timekeepingFind.mockReturnValue(lean([
      {
        uid: "employee-a",
        date: new Date("2026-07-04T00:00:00.000Z"),
        status: "Present",
        checkIn: { time: new Date("2026-07-04T01:00:00.000Z") },
        checkOut: { time: new Date("2026-07-04T10:00:00.000Z") },
      },
    ]));
    const res = response();

    await expect(payrollController.createSnapshot(branchRequest(), res)).resolves.not.toThrow();

    expect(mocks.attendanceFindOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          workedDays: 1,
          workedMinutes: 540,
        }),
      }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it("scopes audit and attendance result reads to the authenticated branch", async () => {
    await payrollController.listAudit(branchRequest(), response());
    await payrollController.listResults(branchRequest(), response());

    expect(mocks.auditFind).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07",
    });
    expect(mocks.attendanceFind).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07",
    });
  });

  it("scopes legacy attendance locking to the branch and blocks it after close", async () => {
    await payrollController.lockResults(branchRequest(), response());

    const branchPeriod = { companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07" };
    expect(mocks.attendanceExists).toHaveBeenCalledWith({ ...branchPeriod, needsRecalculation: true });
    expect(mocks.attendanceUpdateMany).toHaveBeenCalledWith(
      { ...branchPeriod, status: "draft" },
      expect.any(Object),
    );

    vi.clearAllMocks();
    mocks.runFindOne.mockReturnValue(sortedLean({ _id: "closed-a", status: "closed" }));
    const closedResponse = response();
    await payrollController.lockResults(branchRequest(), closedResponse);

    expect(closedResponse.status).toHaveBeenCalledWith(409);
    expect(mocks.attendanceUpdateMany).not.toHaveBeenCalled();
  });

  it("skips formula-library queries and preserves ordinary adjustments in legacy runs", async () => {
    mocks.attendanceFind.mockReturnValue(lean([{
      employeeId: "employee-a", employeeName: "Employee A", monthlySalary: 12_000_000,
      standardDays: 23, standardHours: 184, workedDays: 23, workedMinutes: 11_040,
      shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [], status: "locked",
    }]));
    mocks.adjustmentFind.mockReturnValue(lean([
      { employeeId: "employee-a", kind: "allowance", amount: 100_000 },
      { employeeId: "employee-a", kind: "bonus", amount: 200_000 },
      { employeeId: "employee-a", kind: "deduction", amount: 300_000 },
      { employeeId: "employee-a", kind: "correction", amount: 400_000 },
    ]));
    mocks.profileFind.mockReturnValue(lean([{
      employeeId: "employee-a",
      status: "active",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
      paymentMethod: "transfer",
      bankName: "Igen Bank",
      bankCode: "IGEN",
      bankAccountNumber: "0123456789",
      bankAccountHolder: "EMPLOYEE A",
    }]));
    mocks.runCreate.mockImplementation(async (value) => value);
    const res = response();

    await payrollController.createRun(branchRequest(), res);

    expect(mocks.formulaFind).not.toHaveBeenCalled();
    expect(mocks.evaluatePayrollFormulas).not.toHaveBeenCalled();
    const line = mocks.runCreate.mock.calls[0][0].lines[0];
    expect(line.formulaApplications).toEqual([]);
    expect(line.calculation).toMatchObject({
      allowances: 100_000, bonuses: 200_000, otherDeductions: 300_000, adjustments: 400_000,
    });
    expect(line.payment).toEqual({
      method: "transfer",
      bankName: "Igen Bank",
      bankCode: "IGEN",
      bankAccountNumber: "0123456789",
      bankAccountHolder: "EMPLOYEE A",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns scoped effective payroll lines without mutating stored system values", async () => {
    const systemLine = {
      employeeId: "employee-a",
      employeeName: "Employee A",
      calculation: {
        monthlySalary: 20_000_000,
        adjustedBase: 18_000_000,
        overtime: 1_000_000,
        bonuses: 500_000,
        allowances: 700_000,
        adjustments: 0,
        otherDeductions: 25_000,
        gross: 20_200_000,
        deductions: 1_075_000,
        net: 19_125_000,
      },
      vietnam: {
        income: { bonuses: 500_000, totalIncome: 20_200_000 },
        insurance: { funds: [
          { code: "social", employeeAmount: 400_000 },
          { code: "health", employeeAmount: 100_000 },
          { code: "unemployment", employeeAmount: 50_000 },
        ] },
        tax: { tax: 200_000 },
        deductions: { other: 25_000, advances: 300_000, total: 1_075_000 },
        netPay: 19_125_000,
      },
    };
    const storedLine = structuredClone(systemLine);
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      type: "regular",
      status: "draft",
      lines: [systemLine],
    }));
    mocks.lineOverrideFind.mockReturnValue(lean([{
      employeeId: "employee-a",
      adjustedBase: 17_000_000,
      bonusTotal: 0,
      socialInsurance: 250_000,
      version: 3,
    }]));
    const res = response();

    await payrollController.getRun(branchRequest(), res);

    expect(mocks.lineOverrideFind).toHaveBeenCalledWith({
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      employeeId: { $in: ["employee-a"] },
    });
    const returnedRun = res.json.mock.calls[0][0].data;
    expect(returnedRun.lines).toEqual([storedLine]);
    const returnedLine = returnedRun.effectiveLines[0];
    expect(returnedLine).toMatchObject({
      systemValues: {
        adjustedBase: 18_000_000,
        bonusTotal: 500_000,
        socialInsurance: 400_000,
        hiddenIncome: 700_000,
      },
      overrideValues: {
        adjustedBase: 17_000_000,
        bonusTotal: 0,
        socialInsurance: 250_000,
      },
      effectiveValues: {
        adjustedBase: 17_000_000,
        bonusTotal: 0,
        socialInsurance: 250_000,
        hiddenIncome: 700_000,
      },
      overrideVersion: 3,
      deductionTotal: 925_000,
      net: 17_775_000,
    });
    expect(returnedLine.segmentLines).toEqual([storedLine]);
    expect(returnedLine).toMatchObject({
      calculation: {
        adjustedBase: 17_000_000,
        bonusTotal: 0,
        deductions: 925_000,
        net: 17_775_000,
      },
      vietnam: {
        income: { bonuses: 0, totalIncome: 18_700_000 },
        insurance: { funds: [
          { code: "social", employeeAmount: 250_000 },
          { code: "health", employeeAmount: 100_000 },
          { code: "unemployment", employeeAmount: 50_000 },
        ] },
        tax: { tax: 200_000 },
        deductions: { other: 25_000, advances: 300_000, total: 925_000 },
        netPay: 17_775_000,
      },
    });
    expect(systemLine).toEqual(storedLine);
  });

  it("loads and validates active revision lines for a revision-backed multi-segment regular run", async () => {
    const revisionLines = [{
      employeeId: "employee-a",
      sourceIds: ["contract-a"],
      calculation: { monthlySalary: 6_000, adjustedBase: 5_000, gross: 5_500, net: 5_500 },
      formulaVersion: "vietnam-payroll-1",
      warnings: [],
    }, {
      employeeId: "employee-a",
      sourceIds: ["contract-b"],
      calculation: { monthlySalary: 4_000, adjustedBase: 3_000, gross: 3_500, net: 3_500 },
      formulaVersion: "vietnam-payroll-1",
      warnings: [],
    }];
    const totals = { grossPay: 9_000, deductions: 0, netPay: 9_000 };
    const checksum = calculatePayrollChecksum({ lines: revisionLines, totals });
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "draft",
      activeRevisionId: "revision-a",
      activeRevisionChecksum: checksum,
      lines: [],
    }));
    mocks.revisionFindOne.mockReturnValue(lean({
      _id: "revision-a",
      runId: "run-a",
      status: "completed",
      lines: revisionLines,
      totals,
      checksum,
    }));
    const res = response();

    await payrollController.getRun(branchRequest(), res);

    expect(mocks.revisionFindOne).toHaveBeenCalledWith({
      _id: "revision-a",
      runId: "run-a",
      companyCode: "ACME",
      branchId: "branch-a",
    });
    const returned = res.json.mock.calls[0][0].data;
    expect(returned.lines).toEqual(revisionLines);
    expect(returned.effectiveLines).toHaveLength(1);
    expect(returned.effectiveLines[0]).toMatchObject({
      employeeId: "employee-a",
      segmentLines: revisionLines,
      calculation: { adjustedBase: 8_000, net: 9_000 },
    });
  });

  it("returns a typed not-found error when the period has no payroll run", async () => {
    mocks.runFindOne.mockReturnValue(sortedLean(null));
    const res = response();

    await payrollController.getRun(branchRequest(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "error",
      code: "PAYROLL_RUN_NOT_FOUND",
    }));
  });

  it("repairs a review checksum mismatch once and returns verified effective data", async () => {
    const lines = [{
      employeeId: "employee-a",
      calculation: { monthlySalary: 1000, adjustedBase: 1000, gross: 1000, net: 1000 },
    }];
    const totals = { grossPay: 1000, deductions: 0, netPay: 1000 };
    const sourceChecksum = calculatePayrollChecksum({ lines, totals });
    const originalRun = {
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "review",
      version: 3,
      activeRevisionId: "revision-a",
      activeRevisionChecksum: sourceChecksum,
      effectiveSnapshot: {
        sourceRevisionId: "revision-a",
        sourceRevisionChecksum: sourceChecksum,
        checksum: "tampered",
        lines,
        pinnedAt: new Date(),
      },
    };
    const revision = {
      _id: "revision-a",
      runId: "run-a",
      status: "completed",
      lines,
      totals,
      checksum: sourceChecksum,
    };
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [],
    });
    const validSnapshot = await loader.createSnapshot(scope, { ...originalRun, status: "draft" });
    const repairedRun = { ...originalRun, version: 4, effectiveSnapshot: validSnapshot };
    mocks.runFindOne.mockReturnValue(sortedLean(originalRun));
    mocks.revisionFindOne.mockReturnValue(lean(revision));
    mocks.repairSnapshot.mockResolvedValue(repairedRun);
    const res = response();

    await payrollController.getRun(branchRequest(), res);

    expect(mocks.repairSnapshot).toHaveBeenCalledWith(
      scope,
      "run-a",
      "actor-a",
      3,
      undefined,
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: expect.objectContaining({
        _id: "run-a",
        status: "review",
        version: 4,
        effectiveLines: expect.any(Array),
        effectiveChecksum: validSnapshot.checksum,
      }),
    });
    const returned = res.json.mock.calls[0][0].data;
    expect(returned.effectiveError).toBeUndefined();
  });

  it("does not load or apply regular-period overrides to a supplemental line detail", async () => {
    const supplementalLine = {
      employeeId: "employee-a",
      calculation: {
        monthlySalary: 10_000_000, adjustedBase: 9_000_000, overtime: 0,
        bonuses: 0, allowances: 0, adjustments: 0, otherDeductions: 0,
        gross: 9_000_000, deductions: 0, net: 9_000_000,
      },
    };
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-supplemental",
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      type: "supplemental",
      status: "draft",
      lines: [supplementalLine],
    }));
    mocks.lineOverrideFind.mockReturnValue(lean([{
      employeeId: "employee-a", adjustedBase: 1, version: 9,
    }]));
    const res = response();

    await payrollController.getLineDetail(branchRequest({
      params: { id: "run-supplemental", employeeId: "employee-a" },
    }), res);

    expect(mocks.lineOverrideFind).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data).toMatchObject({
      formulaVersion: "legacy",
      calculation: supplementalLine.calculation,
      overrideValues: {},
      overrideVersion: 0,
      effectiveValues: { adjustedBase: 9_000_000 },
      net: 9_000_000,
    });
  });
});
