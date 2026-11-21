import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  employeeFindOne: vi.fn(),
  logFindOne: vi.fn(),
  save: vi.fn(),
  periodFindOne: vi.fn(),
  periodUpdateMany: vi.fn(),
  payrollFindOne: vi.fn(),
  auditCreate: vi.fn(),
  resolveShift: vi.fn(),
  shiftWindow: vi.fn(),
  periodMutation: vi.fn(),
  employee: null as any,
}));

vi.mock("../model/user.model", () => ({ UserModel: { findOne: mocks.employeeFindOne } }));
vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: Object.assign(vi.fn(function (this: any, data: any) {
    Object.assign(this, data);
    this._id = "log-created";
    this.save = mocks.save;
    this.toObject = () => {
      const { save: _save, toObject: _toObject, ...record } = this;
      return structuredClone(record);
    };
  }), { findOne: mocks.logFindOne }),
}));
vi.mock("../model/attendance-period-result.model", () => ({ AttendancePeriodResultModel: {
  findOne: mocks.periodFindOne,
  updateMany: mocks.periodUpdateMany,
} }));
vi.mock("../model/payroll-run.model", () => ({ PayrollRunModel: { findOne: mocks.payrollFindOne } }));
vi.mock("../model/timekeeping-adjustment-audit.model", () => ({ TimekeepingAdjustmentAuditModel: { create: mocks.auditCreate } }));
vi.mock("../service/attendance-period-mutation.service", () => ({ runAttendancePeriodMutation: mocks.periodMutation }));
vi.mock("../service/work-shift.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../service/work-shift.service")>();
  return { ...actual, resolveShift: mocks.resolveShift, shiftWindow: mocks.shiftWindow };
});

import { timekeepingController } from "./timekeeping.controller";

const employeeId = "507f1f77bcf86cd799439022";
const branchId = "507f1f77bcf86cd799439012";
const date = "2026-11-16";
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.employee = { _id: employeeId, companyCode: "TEST", branchId };
  mocks.employeeFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(mocks.employee) });
  mocks.logFindOne.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined);
  mocks.periodFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  mocks.periodUpdateMany.mockResolvedValue({ modifiedCount: 1 });
  mocks.payrollFindOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
  mocks.auditCreate.mockResolvedValue({});
  mocks.resolveShift.mockResolvedValue({
    source: "company",
    shift: {
      _id: "shift-id", name: "Ca hành chính", code: "HC", startTime: "08:00", endTime: "17:00",
      standardMinutes: 480, breakPeriods: [], allowedLateMinutes: 0, allowedEarlyLeaveMinutes: 0,
    },
  });
  mocks.shiftWindow.mockReturnValue({
    scheduledStartAt: new Date("2026-11-16T01:00:00.000Z"),
    scheduledEndAt: new Date("2026-11-16T10:00:00.000Z"),
  });
  mocks.periodMutation.mockImplementation((_scope, _periodKey, operation) => operation(undefined));
});

const request = (body: Record<string, unknown>) => ({
  body,
  user: { id: "actor-id", companyCode: "TEST", branchId, role: "admin" },
}) as any;

it("creates and audits an adjusted attendance row when the employee has no record for that date", async () => {
  const res = response();

  await timekeepingController.adjustAttendanceRecord(request({
    employeeId,
    date,
    checkInTime: "07:59",
    checkOutTime: "18:00",
    editReason: "Đi công tác",
  }), res);

  expect(res.status).toHaveBeenCalledWith(200);
  const item = res.json.mock.calls[0][0].data;
  expect(item).toMatchObject({
    uid: employeeId,
    companyCode: "TEST",
    branchId,
    date,
    status: "Present",
    manuallyAdjusted: true,
    adjustedBy: "actor-id",
    adjustmentReason: "Đi công tác",
  });
  expect(item.checkIn.time.toISOString()).toBe("2026-11-16T00:59:00.000Z");
  expect(item.checkOut.time.toISOString()).toBe("2026-11-16T11:00:00.000Z");
  expect(mocks.auditCreate).toHaveBeenCalledWith([expect.objectContaining({
    logId: "log-created", employeeId, date, actorId: "actor-id", reason: "Đi công tác", before: {},
  })], {});
  expect(mocks.periodUpdateMany).toHaveBeenCalledWith(
    { companyCode: "TEST", branchId, periodKey: "2026-11", status: "draft" },
    { $set: { needsRecalculation: true } },
    {},
  );
});

it("does not create a missed attendance row after the payroll period is locked", async () => {
  mocks.periodMutation.mockRejectedValueOnce(Object.assign(new Error("Kỳ công đã khóa"), { statusCode: 409 }));
  const res = response();

  await timekeepingController.adjustAttendanceRecord(request({
    employeeId,
    date,
    checkInTime: "07:59",
    editReason: "Quên chấm công",
  }), res);

  expect(res.status).toHaveBeenCalledWith(409);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.auditCreate).not.toHaveBeenCalled();
});
