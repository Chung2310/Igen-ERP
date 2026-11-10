import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import {
  WorkerProjectService,
  buildWorkerProjectQuery,
  normalizeWorkerProjectInput,
} from "./worker-project.service";

afterEach(() => vi.restoreAllMocks());

describe("worker project service", () => {
  it("scopes projects by company and branch", () => {
    const HN_id = new Types.ObjectId();
    const query = buildWorkerProjectQuery({ companyCode: "ACME", branchId: HN_id.toString() });
    
    expect(query.companyCode).toBe("ACME");
    expect(query.branchId).toBeInstanceOf(Types.ObjectId);
    expect(query.branchId!.toString()).toBe(HN_id.toString());
    expect(query.deletedAt).toBeNull();
  });

  it("requires a project name and normalizes project defaults", () => {
    expect(() => normalizeWorkerProjectInput({ name: "" })).toThrow("Project name is required");
    
    const normalized = normalizeWorkerProjectInput({
      name: " Site A ",
      code: " da-1 ",
      startTime: "",
      endTime: "",
    });

    expect(normalized).toMatchObject({
      name: "Site A",
      code: "DA-1",
      startTime: "08:00",
      endTime: "17:00",
      workerIds: [],
    });
  });

  it("stores project members as Worker references", () => {
    const workerIds = WorkerProjectModel.schema.path("workerIds") as any;

    expect(workerIds.embeddedSchemaType.options.ref).toBe("Worker");
  });

  it.each([
    "a worker from another company",
    "a worker from another branch",
    "a deleted worker",
  ])("rejects %s as not found before changing membership", async () => {
    const projectId = new Types.ObjectId();
    const workerId = new Types.ObjectId();
    const branchId = new Types.ObjectId().toString();
    const findWorker = vi.spyOn(WorkerModel, "findOne").mockResolvedValue(null);
    const updateProject = vi
      .spyOn(WorkerProjectModel, "findOneAndUpdate")
      .mockResolvedValue({ _id: projectId } as any);

    await expect(
      WorkerProjectService.addWorker(
        { companyCode: "ACME", branchId },
        projectId.toString(),
        workerId.toString(),
      ),
    ).rejects.toThrow(/not found/i);

    expect(findWorker).toHaveBeenCalledWith({
      _id: workerId,
      companyCode: "ACME",
      branchId,
      deletedAt: null,
    });
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("validates every initial member before creating a project", async () => {
    const workerId = new Types.ObjectId();
    const branchId = new Types.ObjectId().toString();
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(null);
    const findWorker = vi.spyOn(WorkerModel, "findOne").mockResolvedValue(null);
    const save = vi
      .spyOn(WorkerProjectModel.prototype, "save")
      .mockResolvedValue({ _id: new Types.ObjectId() } as any);

    await expect(
      WorkerProjectService.create(
        { companyCode: "ACME", branchId },
        { name: "Project", code: "P-1", workerIds: [workerId.toString()] },
      ),
    ).rejects.toThrow(/not found/i);

    expect(findWorker).toHaveBeenCalledWith({
      _id: workerId,
      companyCode: "ACME",
      branchId,
      deletedAt: null,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("validates replacement members before updating a project", async () => {
    const projectId = new Types.ObjectId();
    const workerId = new Types.ObjectId();
    const branchId = new Types.ObjectId().toString();
    vi.spyOn(WorkerProjectModel, "findOne")
      .mockReturnValueOnce({ lean: async () => ({
        _id: projectId, companyCode: "ACME", branchId, code: "P-1", name: "Project", workerIds: [], deletedAt: null,
      }) } as any)
      .mockResolvedValueOnce(null);
    vi.spyOn(WorkerModel, "findOne").mockResolvedValue(null);
    const update = vi
      .spyOn(WorkerProjectModel, "findOneAndUpdate")
      .mockResolvedValue({ _id: projectId } as any);

    await expect(
      WorkerProjectService.update(
        { companyCode: "ACME", branchId },
        projectId.toString(),
        { name: "Project", code: "P-1", workerIds: [workerId.toString()] },
      ),
    ).rejects.toThrow(/not found/i);

    expect(update).not.toHaveBeenCalled();
  });

  it("preserves unmentioned project fields and members during a single-field update", async () => {
    const projectId = new Types.ObjectId();
    const workerId = new Types.ObjectId();
    const branchId = new Types.ObjectId().toString();
    const current = {
      _id: projectId, companyCode: "ACME", branchId, code: "P-1", name: "Project",
      quota: 8, workerIds: [workerId], daysOfWeek: [1, 3], startTime: "08:00", endTime: "17:00",
      location: "Old location", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", note: "Keep",
      geoLocation: null, deletedAt: null,
    };
    vi.spyOn(WorkerProjectModel, "findOne")
      .mockReturnValueOnce({ lean: async () => current } as any)
      .mockResolvedValueOnce(null);
    vi.spyOn(WorkerModel, "findOne").mockResolvedValue({ _id: workerId } as any);
    const update = vi.spyOn(WorkerProjectModel, "findOneAndUpdate").mockResolvedValue({ ...current, location: "New location" } as any);

    await WorkerProjectService.update({ companyCode: "ACME", branchId }, projectId.toString(), { location: "New location" });

    expect(update).toHaveBeenCalledWith(
      { _id: projectId, companyCode: "ACME", branchId: new Types.ObjectId(branchId), deletedAt: null },
      { $set: expect.objectContaining({
        code: "P-1", name: "Project", quota: 8, workerIds: [workerId], daysOfWeek: [1, 3],
        startTime: "08:00", endTime: "17:00", location: "New location", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", note: "Keep",
      }) },
      { returnDocument: "after" },
    );
  });
});
