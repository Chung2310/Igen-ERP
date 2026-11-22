import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logFindOne: vi.fn(),
  logFindOneAndUpdate: vi.fn(),
  logSave: vi.fn(),
  attemptCreate: vi.fn(),
  companyFindOne: vi.fn(),
  resolveShift: vi.fn(),
  shiftWindow: vi.fn(),
  resourceIndex: vi.fn(),
  userFindById: vi.fn(),
}));

vi.mock("../model/company.model", () => ({ CompanyModel: { findOne: mocks.companyFindOne } }));
vi.mock("../model/user.model", () => ({ UserModel: { findById: mocks.userFindById } }));
vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: Object.assign(vi.fn(function (this: any, value: any) {
    Object.assign(this, value);
    this._id = "new-log";
    this.save = mocks.logSave;
  }), {
    findOne: mocks.logFindOne,
    findOneAndUpdate: mocks.logFindOneAndUpdate,
  }),
}));
vi.mock("../model/attendance-attempt.model", () => ({ AttendanceAttemptModel: { create: mocks.attemptCreate } }));
vi.mock("../service/attendance-resource.service", () => ({
  attendanceResourceService: { indexAcceptedEvidence: mocks.resourceIndex },
}));
vi.mock("../service/work-shift.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../service/work-shift.service")>();
  return { ...actual, resolveShift: mocks.resolveShift, shiftWindow: mocks.shiftWindow };
});

import { timekeepingController } from "./timekeeping.controller";
import { vietnamWorkDate } from "../service/work-shift.service";

const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const gate = { uid: "employee-a", companyCode: "ACME", branchId: "branch-a", distance: 5, action: "check-in" };
const request = (path: string) => ({
  path,
  headers: {},
  ip: "127.0.0.1",
  body: { latitude: 10, longitude: 20, deviceInfo: "test-device" },
  user: { id: "employee-a", companyCode: "ACME", branchId: "branch-a" },
  attendanceBranchGate: gate,
}) as any;
const candidateQuery = (value: any) => ({ sort: vi.fn().mockResolvedValue(value) });
const candidate = (overrides: Record<string, unknown> = {}) => ({
  _id: "log-a",
  uid: "employee-a",
  companyCode: "ACME",
  branchId: "branch-a",
  date: vietnamWorkDate(),
  checkIn: null,
  checkOut: null,
  scheduledStartAt: new Date("2026-11-20T01:00:00.000Z"),
  scheduledEndAt: new Date("2026-11-20T10:00:00.000Z"),
  workDate: vietnamWorkDate(),
  ...overrides,
});

describe("timekeeping check-in and check-out writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.companyFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mocks.logFindOne.mockReturnValue(candidateQuery(null));
    mocks.logFindOneAndUpdate.mockResolvedValue(null);
    mocks.logSave.mockResolvedValue(undefined);
    mocks.attemptCreate.mockResolvedValue({});
    mocks.resourceIndex.mockResolvedValue(undefined);
    mocks.userFindById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    mocks.resolveShift.mockResolvedValue({ shift: { _id: "shift-a", name: "Hành chính", code: "HC", allowedLateMinutes: 0, allowedEarlyLeaveMinutes: 0 } });
    mocks.shiftWindow.mockReturnValue({
      scheduledStartAt: new Date("2026-11-20T01:00:00.000Z"),
      scheduledEndAt: new Date("2026-11-20T10:00:00.000Z"),
    });
  });

  it("does not overwrite a concurrent check-in", async () => {
    mocks.logFindOne.mockReturnValue(candidateQuery(candidate()));
    const res = response();

    await timekeepingController.checkIn(request("/check-in"), res);

    expect(mocks.logFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "log-a", checkIn: null },
      expect.objectContaining({ $set: expect.objectContaining({ checkIn: expect.any(Object) }) }),
      expect.objectContaining({ returnDocument: "after" }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.logSave).not.toHaveBeenCalled();
  });

  it("does not overwrite a concurrent check-out", async () => {
    mocks.logFindOne.mockReturnValue(candidateQuery(candidate({ checkIn: { time: new Date("2026-11-20T01:00:00.000Z") } })));
    const res = response();

    await timekeepingController.checkOut(request("/check-out"), res);

    expect(mocks.logFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "log-a", checkOut: null },
      expect.objectContaining({ $set: expect.objectContaining({ checkOut: expect.any(Object) }) }),
      expect.objectContaining({ returnDocument: "after" }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("reports an already-created check-in as a conflict when the unique index wins a race", async () => {
    mocks.logSave.mockRejectedValueOnce({ code: 11000, message: "duplicate key details" });
    const res = response();

    await timekeepingController.checkIn(request("/check-in"), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).not.toHaveProperty("details");
  });

  it("keeps the attendance action successful if post-save evidence logging fails", async () => {
    mocks.attemptCreate.mockRejectedValueOnce(new Error("audit store unavailable"));
    const res = response();

    await timekeepingController.checkIn(request("/check-in"), res);

    expect(mocks.logSave).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].message.toLocaleLowerCase("vi")).toContain("đã chấm công vào thành công");
  });
});
