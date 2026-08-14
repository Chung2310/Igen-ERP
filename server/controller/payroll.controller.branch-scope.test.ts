import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attendanceFind: vi.fn(),
  attendanceDeleteMany: vi.fn(),
  payrollFindOne: vi.fn(),
  payrollFindOneAndUpdate: vi.fn(),
  payrollDeleteOne: vi.fn(),
  payrollCreate: vi.fn(),
  payrollExists: vi.fn(),
  auditCreate: vi.fn(),
  auditDeleteMany: vi.fn(),
  adjustmentCreate: vi.fn(),
  adjustmentFind: vi.fn(),
  adjustmentFindOneAndUpdate: vi.fn(),
  adjustmentDeleteMany: vi.fn(),
  resetPayrollPeriod: vi.fn(),
  policyFind: vi.fn(),
  profileFind: vi.fn(),
  dependentFind: vi.fn(),
  periodInputFind: vi.fn(),
  customVariableFind: vi.fn(),
  lineOverrideFind: vi.fn(),
  publicationFind: vi.fn(),
  publicationFindOneAndUpdate: vi.fn(),
  loadEffectiveLines: vi.fn(),
  createEffectiveSnapshot: vi.fn(),
  verifyEffectiveSnapshot: vi.fn(),
  transactionRunner: vi.fn(),
}));

vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: {
    find: mocks.attendanceFind,
    deleteMany: mocks.attendanceDeleteMany,
  },
}));
vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.payrollFindOne,
    findOneAndUpdate: mocks.payrollFindOneAndUpdate,
    deleteOne: mocks.payrollDeleteOne,
    create: mocks.payrollCreate,
    exists: mocks.payrollExists,
  },
}));
vi.mock("../model/payroll-adjustment.model", () => ({
  PayrollAdjustmentModel: {
    create: mocks.adjustmentCreate,
    find: mocks.adjustmentFind,
    findOneAndUpdate: mocks.adjustmentFindOneAndUpdate,
    deleteMany: mocks.adjustmentDeleteMany,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate, deleteMany: mocks.auditDeleteMany },
}));
vi.mock("../model/payroll-policy.model", () => ({ PayrollPolicyModel: { find: mocks.policyFind } }));
vi.mock("../model/payroll-profile.model", () => ({
  PayrollProfileModel: { find: mocks.profileFind },
  PayrollDependentModel: { find: mocks.dependentFind },
}));
vi.mock("../model/payroll-period-input.model", () => ({
  PayrollPeriodInputModel: { find: mocks.periodInputFind },
}));
vi.mock("../model/payroll-custom-variable.model", () => ({
  PayrollCustomVariableModel: { find: mocks.customVariableFind },
}));
vi.mock("../model/payroll-line-override.model", () => ({
  PayrollLineOverrideModel: { find: mocks.lineOverrideFind },
}));
vi.mock("../model/payslip-publication.model", () => ({
  PayslipPublicationModel: {
    find: mocks.publicationFind,
    findOneAndUpdate: mocks.publicationFindOneAndUpdate,
  },
}));
vi.mock("../service/payroll-period-reset.service", () => ({
  resetPayrollPeriod: mocks.resetPayrollPeriod,
}));
vi.mock("../service/payroll-effective-line.service", () => ({
  loadAuthoritativePayrollLines: mocks.loadEffectiveLines,
  createEffectivePayrollSnapshot: mocks.createEffectiveSnapshot,
  verifyEffectivePayrollSnapshot: mocks.verifyEffectiveSnapshot,
}));
vi.mock("../service/payroll-transaction.service", () => ({
  runPayrollAtomicTransaction: mocks.transactionRunner,
}));

import { payrollController } from "./payroll.controller";
import { DEFAULT_VIETNAM_PAYROLL_POLICY } from "../config/payroll-default-policy";

const requestForBranchA: any = {
  user: { id: "actor-a", role: "admin", companyCode: "ACME", branchId: "branch-a" },
  params: { periodKey: "2026-07" },
};

const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const sortedLean = <T>(value: T) => {
  const lean = vi.fn().mockResolvedValue(value);
  const sort = vi.fn().mockReturnValue({ lean });
  return { query: { sort }, sort, lean };
};

describe("payrollController.createRun branch scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
    mocks.attendanceDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mocks.adjustmentDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mocks.auditDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mocks.payrollDeleteOne.mockResolvedValue({ deletedCount: 0 });
    mocks.resetPayrollPeriod.mockResolvedValue({
      deleted: { run: 1, results: 2, adjustments: 3, overrides: 4, audits: 5 },
    });
    mocks.payrollExists.mockResolvedValue(null);
    mocks.payrollFindOne.mockReturnValue(sortedLean(null).query);
    mocks.policyFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([DEFAULT_VIETNAM_PAYROLL_POLICY]) });
    mocks.profileFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.dependentFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.adjustmentFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.periodInputFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.customVariableFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.lineOverrideFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.publicationFind.mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    });
    mocks.publicationFindOneAndUpdate.mockResolvedValue({});
    mocks.loadEffectiveLines.mockImplementation(async (_scope, run) => ({
      sourceLines: run.lines ?? [],
      effectiveLines: run.lines ?? [],
      effectiveChecksum: "effective-checksum",
    }));
    mocks.createEffectiveSnapshot.mockResolvedValue({
      sourceRevisionChecksum: "legacy-checksum",
      checksum: "effective-checksum",
      lines: [{ employeeId: "employee-a", calculation: { net: 100 } }],
    });
    mocks.verifyEffectiveSnapshot.mockResolvedValue(true);
    mocks.transactionRunner.mockImplementation((operation: any) => operation(undefined));
  });

  it("does not consume Branch B locked attendance for a Branch A run", async () => {
    mocks.attendanceFind.mockImplementation((filter) => ({
      lean: async () => filter.branchId === "branch-a" ? [] : [{ employeeId: "branch-b-employee" }],
    }));
    const res = response();

    await payrollController.createRun(requestForBranchA, res);

    expect(mocks.attendanceFind).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", status: "locked",
    });
    expect(mocks.payrollFindOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("does not let a Branch B run block a Branch A run", async () => {
    const branchARow = {
      employeeId: "branch-a-employee", monthlySalary: 100, standardDays: 1, standardHours: 8,
      workedMinutes: 480, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
    };
    mocks.attendanceFind.mockReturnValue({ lean: async () => [branchARow] });
    const existing = sortedLean(null);
    mocks.payrollFindOne.mockReturnValue(existing.query);
    mocks.payrollCreate.mockResolvedValue({ _id: "branch-a-run" });
    const res = response();

    await payrollController.createRun(requestForBranchA, res);

    expect(mocks.payrollFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", type: "regular",
    });
    expect(existing.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(mocks.payrollCreate).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-a", type: "regular" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("recalculates a legacy draft through an exact version-and-status claim", async () => {
    const branchARow = {
      employeeId: "branch-a-employee", monthlySalary: 100, standardDays: 1, standardHours: 8,
      workedMinutes: 480, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
    };
    mocks.attendanceFind.mockReturnValue({ lean: async () => [branchARow] });
    const existing = sortedLean({
      _id: "branch-a-run",
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      type: "regular",
      status: "draft",
      version: 4,
      lines: [{ employeeId: "branch-a-employee", calculation: { net: 50 } }],
    });
    mocks.payrollFindOne.mockReturnValue(existing.query);
    mocks.payrollFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "branch-a-run", status: "draft", version: 5 }),
    });
    const res = response();

    await payrollController.createRun(requestForBranchA, res);

    expect(mocks.payrollFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: "branch-a-run",
        companyCode: "ACME",
        branchId: "branch-a",
        periodKey: "2026-07",
        type: "regular",
        activeRevisionId: { $exists: false },
        status: "draft",
        version: 4,
      },
      { $set: { lines: expect.any(Array) }, $inc: { version: 1 } },
      { new: true },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "success",
      data: expect.objectContaining({ version: 5 }),
    }));
  });

  it("fails a legacy recalculation when review wins the version claim", async () => {
    const branchARow = {
      employeeId: "branch-a-employee", monthlySalary: 100, standardDays: 1, standardHours: 8,
      workedMinutes: 480, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
    };
    mocks.attendanceFind.mockReturnValue({ lean: async () => [branchARow] });
    mocks.payrollFindOne.mockReturnValue(sortedLean({
      _id: "branch-a-run",
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      type: "regular",
      status: "draft",
      version: 4,
      lines: [{ employeeId: "branch-a-employee", calculation: { net: 50 } }],
    }).query);
    mocks.payrollFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    const res = response();

    await payrollController.createRun(requestForBranchA, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      code: "PAYROLL_VERSION_CONFLICT",
      message: "Payroll run changed while it was being recalculated",
    });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("gets the deterministic regular run only from the authenticated branch", async () => {
    const selected = sortedLean({ _id: "branch-a-regular" });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    const res = response();

    await payrollController.getRun(requestForBranchA, res);

    expect(mocks.payrollFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", type: "regular",
    });
    expect(selected.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: {
        _id: "branch-a-regular",
        lines: [],
        effectiveLines: [],
        effectiveChecksum: "effective-checksum",
        publishedEmployeeIds: [],
      },
    });
  });

  it("returns active revision totals with active revision lines", async () => {
    const selected = sortedLean({
      _id: "branch-a-regular",
      status: "draft",
      totals: { grossPay: 0, deductions: 0, netPay: 0 },
    });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    mocks.loadEffectiveLines.mockResolvedValue({
      sourceLines: [{ employeeId: "employee-a", calculation: { net: 900 } }],
      sourceTotals: { grossPay: 1_000, deductions: 100, netPay: 900 },
      effectiveLines: [{ employeeId: "employee-a", calculation: { net: 900 } }],
      effectiveChecksum: "effective-checksum",
    });
    const res = response();

    await payrollController.getRun(requestForBranchA, res);

    expect(res.json.mock.calls[0][0].data).toMatchObject({
      lines: [{ employeeId: "employee-a", calculation: { net: 900 } }],
      totals: { grossPay: 1_000, deductions: 100, netPay: 900 },
    });
  });

  it("hides stale payslip publications after a run is reopened or still in review", async () => {
    const selected = sortedLean({
      _id: "branch-a-regular",
      status: "review",
      lines: [{ employeeId: "employee-a", calculation: { net: 100 } }],
    });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    const res = response();

    await payrollController.getRun(requestForBranchA, res);

    expect(mocks.publicationFind).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.publishedEmployeeIds).toEqual([]);
  });

  it.each([
    ["approveRun", "draft", "review"],
    ["closeRun", "review", "closed"],
  ] as const)("%s mutates only the deterministic regular run in the authenticated branch", async (method, fromStatus, toStatus) => {
    const selected = sortedLean({
      _id: "branch-a-regular",
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-07",
      type: "regular",
      status: fromStatus,
      version: 2,
      lines: [{ employeeId: "employee-a", calculation: { net: 100 } }],
      ...(fromStatus === "review" ? { effectiveSnapshot: { checksum: "effective-checksum" } } : {}),
    });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    mocks.payrollFindOneAndUpdate.mockResolvedValue({ _id: "branch-a-regular", status: toStatus });
    const res = response();

    await payrollController[method](requestForBranchA, res);

    expect(mocks.payrollFindOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: "branch-a-regular", companyCode: "ACME", branchId: "branch-a",
        periodKey: "2026-07", type: "regular", status: fromStatus,
        activeRevisionId: { $exists: false }, version: 2,
      },
      expect.any(Object),
      { new: true },
    );
    expect(selected.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
  });

  it("resets only the selected regular run and branch-owned period records", async () => {
    const res = response();

    await payrollController.resetPeriod(requestForBranchA, res);

    expect(mocks.resetPayrollPeriod).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "branch-a" },
      "2026-07",
      "actor-a",
    );
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      deleted: { run: 1, results: 2, adjustments: 3, overrides: 4, audits: 5 },
    });
  });

  it("creates and approves adjustments only inside the authenticated branch", async () => {
    mocks.adjustmentCreate.mockResolvedValue({ _id: "adjustment-a" });
    mocks.adjustmentFindOneAndUpdate.mockResolvedValue({ _id: "adjustment-a" });
    const adjustmentRequest = {
      ...requestForBranchA,
      params: { ...requestForBranchA.params, adjustmentId: "adjustment-a" },
      body: { employeeId: "employee-a", kind: "bonus", amount: 100, reason: "Approved bonus" },
    };

    await payrollController.createAdjustment(adjustmentRequest, response());
    await payrollController.approveAdjustment(adjustmentRequest, response());

    expect(mocks.adjustmentCreate).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07",
    }));
    expect(mocks.adjustmentFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "adjustment-a", companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07",
      }),
      expect.any(Object),
      { new: true },
    );
  });
});
