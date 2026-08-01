import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
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
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne },
}));
vi.mock("../model/company.model", () => ({
  CompanyModel: { findOne: mocks.companyFindOne },
}));
vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: { find: mocks.timekeepingFind },
}));
vi.mock("../model/hr-leave-application.model", () => ({
  HRLeaveApplicationModel: { find: mocks.leaveFind },
}));
vi.mock("../model/company-work-calendar.model", () => ({
  CompanyWorkCalendarDayModel: { find: mocks.calendarFind },
}));
vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: {
    findOneAndUpdate: mocks.attendanceFindOneAndUpdate,
    find: mocks.attendanceFind,
    exists: mocks.attendanceExists,
    updateMany: mocks.attendanceUpdateMany,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { find: mocks.auditFind, create: mocks.auditCreate },
}));

import { payrollController } from "./payroll.controller";

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
});
