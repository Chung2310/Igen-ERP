import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attendanceFind: vi.fn(),
  attendanceDeleteMany: vi.fn(),
  payrollFindOne: vi.fn(),
  payrollFindOneAndUpdate: vi.fn(),
  payrollDeleteOne: vi.fn(),
  payrollCreate: vi.fn(),
  auditCreate: vi.fn(),
  auditDeleteMany: vi.fn(),
  adjustmentCreate: vi.fn(),
  adjustmentFindOneAndUpdate: vi.fn(),
  adjustmentDeleteMany: vi.fn(),
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
  },
}));
vi.mock("../model/payroll-adjustment.model", () => ({
  PayrollAdjustmentModel: {
    create: mocks.adjustmentCreate,
    findOneAndUpdate: mocks.adjustmentFindOneAndUpdate,
    deleteMany: mocks.adjustmentDeleteMany,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate, deleteMany: mocks.auditDeleteMany },
}));

import { payrollController } from "./payroll.controller";

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

  it("gets the deterministic regular run only from the authenticated branch", async () => {
    const selected = sortedLean({ _id: "branch-a-regular" });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    const res = response();

    await payrollController.getRun(requestForBranchA, res);

    expect(mocks.payrollFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", type: "regular",
    });
    expect(selected.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(res.json).toHaveBeenCalledWith({ status: "success", data: { _id: "branch-a-regular" } });
  });

  it.each([
    ["approveRun", "calculated", "approved"],
    ["closeRun", "approved", "closed"],
  ] as const)("%s mutates only the deterministic regular run in the authenticated branch", async (method, fromStatus, toStatus) => {
    mocks.payrollFindOneAndUpdate.mockResolvedValue({ _id: "branch-a-regular", status: toStatus });
    const res = response();

    await payrollController[method](requestForBranchA, res);

    expect(mocks.payrollFindOneAndUpdate).toHaveBeenCalledWith(
      {
        companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07",
        type: "regular", status: fromStatus,
      },
      expect.any(Object),
      expect.objectContaining({ new: true, sort: { createdAt: 1, _id: 1 } }),
    );
  });

  it("resets only the selected regular run and branch-owned period records", async () => {
    const selected = sortedLean({ _id: "branch-a-regular" });
    mocks.payrollFindOne.mockReturnValue(selected.query);
    mocks.payrollDeleteOne.mockResolvedValue({ deletedCount: 1 });
    const res = response();

    await payrollController.resetPeriod(requestForBranchA, res);

    expect(mocks.payrollDeleteOne).toHaveBeenCalledWith({
      _id: "branch-a-regular", companyCode: "ACME", branchId: "branch-a",
      periodKey: "2026-07", type: "regular",
    });
    const branchPeriod = { companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07" };
    expect(mocks.attendanceDeleteMany).toHaveBeenCalledWith(branchPeriod);
    expect(mocks.adjustmentDeleteMany).toHaveBeenCalledWith(branchPeriod);
    expect(mocks.auditDeleteMany).toHaveBeenCalledWith(branchPeriod);
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
