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

  it("does not allow Branch A to patch a Branch B timekeeping log", async () => {
    mocks.timekeepingFindOne.mockImplementation((filter) => ({
      lean: vi.fn().mockResolvedValue(filter.branchId === "branch-b"
        ? { _id: "branch-b-log", uid: "employee-b", date: "2026-07-15", branchId: "branch-b" }
        : null),
    }));
    const req: any = {
      params: { modelName: "timekeeping-logs", id: "branch-b-log" },
      body: { editReason: "Unauthorized correction" },
      user: { id: "actor-a", role: "admin", companyCode: "ACME", branchId: "branch-a" },
    };
    const res = response();

    await crudController.update(req, res);

    expect(mocks.timekeepingFindOne).toHaveBeenCalledWith({
      _id: "branch-b-log",
      companyCode: "ACME",
      branchId: { $in: ["branch-a", null, undefined] },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.crudUpdate).not.toHaveBeenCalled();
    expect(mocks.attendanceFindOne).not.toHaveBeenCalled();
    expect(mocks.payrollFindOne).not.toHaveBeenCalled();
  });

  it("blocks a branch-owned timekeeping edit when its deterministic regular run is closed", async () => {
    mocks.payrollFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: "closed-a", status: "closed" }),
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "closed-a", status: "closed" }) }),
    });
    const req: any = {
      params: { modelName: "timekeeping-logs", id: "log-a" },
      body: { editReason: "Correct missed checkout" },
      user: { id: "actor-a", role: "admin", companyCode: "ACME", branchId: "branch-a" },
    };
    const res = response();

    await crudController.update(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.crudUpdate).not.toHaveBeenCalled();
  });
});
