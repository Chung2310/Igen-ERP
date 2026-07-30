import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attendanceFind: vi.fn(),
  payrollFindOne: vi.fn(),
  payrollCreate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: { find: mocks.attendanceFind },
}));
vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.payrollFindOne, create: mocks.payrollCreate },
}));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));

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

describe("payrollController.createRun branch scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.payrollFindOne.mockImplementation((filter) => filter.branchId === "branch-a" ? null : { _id: "branch-b-run" });
    mocks.payrollCreate.mockResolvedValue({ _id: "branch-a-run" });
    const res = response();

    await payrollController.createRun(requestForBranchA, res);

    expect(mocks.payrollFindOne).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07" });
    expect(mocks.payrollCreate).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-a" }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
