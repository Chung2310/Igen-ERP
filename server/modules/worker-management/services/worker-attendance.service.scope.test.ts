import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { WorkerAttendanceLogModel } from "../models/worker-attendance-log.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerAttendanceService } from "./worker-attendance.service";

afterEach(() => vi.restoreAllMocks());

const projectId = new Types.ObjectId();
const workerId = new Types.ObjectId();
const branchId = new Types.ObjectId();
const project = {
  _id: projectId,
  companyCode: "ACME",
  branchId,
  workerIds: [workerId],
  startTime: "08:00",
  endTime: "17:00",
  geoLocation: null,
};

describe("worker attendance scope", () => {
  it("scopes marking to the signed-in branch and stores the project's branch", async () => {
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(project as any);
    vi.spyOn(WorkerAttendanceLogModel, "findOne").mockResolvedValue(null);
    const create = vi.spyOn(WorkerAttendanceLogModel, "create").mockResolvedValue({ status: "missing-checkout" } as any);

    await WorkerAttendanceService.mark({
      projectId: projectId.toString(),
      workerId: workerId.toString(),
      companyCode: "ACME",
      branchId: branchId.toString(),
      allowManual: true,
      recordedBy: "manager-1",
      at: new Date("2026-08-04T02:00:00.000Z"),
    });

    expect(WorkerProjectModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      _id: projectId,
      companyCode: "ACME",
      branchId,
      deletedAt: null,
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ branchId }));
  });

  it("requires GPS for self-service marks even when an actor ID is present", async () => {
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue({
      ...project,
      geoLocation: { latitude: 21.0278, longitude: 105.8342, radiusMeters: 300 },
    } as any);

    await expect(WorkerAttendanceService.mark({
      projectId: projectId.toString(),
      workerId: workerId.toString(),
      companyCode: "ACME",
      recordedBy: "manager-1",
      at: new Date("2026-08-04T02:00:00.000Z"),
    })).rejects.toMatchObject({ reasonCode: "missing_location" });
  });

  it("turns a simultaneous first check-in into the normal minimum-gap response", async () => {
    const now = new Date("2026-08-04T02:00:00.000Z");
    const duplicate = Object.assign(new Error("duplicate attendance key"), { code: 11000 });
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(project as any);
    vi.spyOn(WorkerAttendanceLogModel, "findOne")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ checkIn: { time: new Date(now.getTime() - 60_000) } } as any);
    vi.spyOn(WorkerAttendanceLogModel, "create").mockRejectedValue(duplicate);

    await expect(WorkerAttendanceService.mark({
      projectId: projectId.toString(),
      workerId: workerId.toString(),
      companyCode: "ACME",
      allowManual: true,
      at: now,
    })).rejects.toMatchObject({ reasonCode: "too_soon" });
  });

  it("does not overwrite a checkout that another request already completed", async () => {
    const log = {
      _id: new Types.ObjectId(),
      checkIn: { time: new Date("2026-08-04T01:00:00.000Z") },
      checkOut: null,
    };
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(project as any);
    vi.spyOn(WorkerAttendanceLogModel, "findOne").mockResolvedValue(log as any);
    vi.spyOn(WorkerAttendanceLogModel, "findOneAndUpdate").mockResolvedValue(null);

    await expect(WorkerAttendanceService.mark({
      projectId: projectId.toString(),
      workerId: workerId.toString(),
      companyCode: "ACME",
      allowManual: true,
      at: new Date("2026-08-04T02:00:00.000Z"),
    })).rejects.toMatchObject({ reasonCode: "already_completed" });
  });

  it("checks project branch scope before returning attendance rows", async () => {
    const projectQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(project),
    };
    vi.spyOn(WorkerProjectModel, "findOne").mockReturnValue(projectQuery as any);
    const logQuery = { sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) };
    const findLogs = vi.spyOn(WorkerAttendanceLogModel, "find").mockReturnValue(logQuery as any);

    await WorkerAttendanceService.listByProjectDate("ACME", projectId.toString(), "2026-08-04", branchId.toString());

    expect(WorkerProjectModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ branchId }));
    expect(findLogs).toHaveBeenCalledWith({ companyCode: "ACME", projectId, date: "2026-08-04" });
  });

  it("refuses adjustments that move check-in to another Vietnam work date", async () => {
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(project as any);
    const save = vi.fn();
    vi.spyOn(WorkerAttendanceLogModel, "findOne").mockResolvedValue({
      _id: new Types.ObjectId(),
      projectId,
      companyCode: "ACME",
      date: "2026-08-04",
      checkIn: { time: new Date("2026-08-04T01:00:00.000Z") },
      checkOut: null,
      save,
    } as any);

    await expect(WorkerAttendanceService.adjust(
      "ACME",
      new Types.ObjectId().toString(),
      projectId.toString(),
      { checkInAt: "2026-08-05T01:00:00.000Z" },
      "manager-1",
      branchId.toString(),
    )).rejects.toMatchObject({ reasonCode: "invalid_work_date" });
    expect(save).not.toHaveBeenCalled();
    expect(WorkerProjectModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ branchId }));
  });

  it("rejects a checkout without a check-in", async () => {
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(project as any);
    vi.spyOn(WorkerAttendanceLogModel, "findOne").mockResolvedValue({
      _id: new Types.ObjectId(),
      projectId,
      companyCode: "ACME",
      date: "2026-08-04",
      checkIn: null,
      checkOut: null,
      save: vi.fn(),
    } as any);

    await expect(WorkerAttendanceService.adjust(
      "ACME",
      new Types.ObjectId().toString(),
      projectId.toString(),
      { checkOutAt: "2026-08-04T10:00:00.000Z" },
      "manager-1",
      branchId.toString(),
    )).rejects.toMatchObject({ reasonCode: "invalid_range" });
  });
});
