import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  crudUpdate: vi.fn(),
  timekeepingFindOne: vi.fn(),
  attendanceFindOne: vi.fn(),
  payrollFindOne: vi.fn(),
}));

vi.mock("../service/crud.service", () => ({
  crudService: { update: mocks.crudUpdate },
}));
vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: { findOne: mocks.timekeepingFindOne },
}));
vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: { findOne: mocks.attendanceFindOne },
}));
vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.payrollFindOne },
}));

import { crudController } from "./crud.controller";

const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const branchSensitiveQuery = (filter: any, branchBValue: any) => {
  const value = filter.branchId === "branch-a" ? null : branchBValue;
  const lean = vi.fn().mockResolvedValue(value);
  return { lean, sort: vi.fn().mockReturnValue({ lean }) };
};

describe("crudController payroll period guard branch scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.crudUpdate.mockResolvedValue(null);
    mocks.timekeepingFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "log-a", uid: "employee-a", date: "2026-07-15", branchId: "branch-a",
      }),
    });
    mocks.attendanceFindOne.mockImplementation((filter) => branchSensitiveQuery(filter, { _id: "branch-b-result" }));
    mocks.payrollFindOne.mockImplementation((filter) => branchSensitiveQuery(filter, { _id: "branch-b-run" }));
  });

  it("does not let another branch or a supplemental run block a timekeeping edit", async () => {
    const req: any = {
      params: { modelName: "timekeeping-logs", id: "log-a" },
      body: { editReason: "Correct missed checkout" },
      user: { id: "actor-a", role: "admin", companyCode: "ACME", branchId: "branch-a" },
    };

    await crudController.update(req, response());

    expect(mocks.attendanceFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", status: "locked",
    });
    expect(mocks.payrollFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07", type: "regular",
    });
    expect(mocks.crudUpdate).toHaveBeenCalledOnce();
  });
});
