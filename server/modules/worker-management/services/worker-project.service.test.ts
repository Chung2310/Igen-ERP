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
    vi.spyOn(WorkerProjectModel, "findOne").mockResolvedValue(null);
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
});
