import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import {
  changeJobStatus,
  createJob,
  getJob,
  listJobs,
  restoreJob,
  softDeleteJob,
  updateJob,
} from "./recruitment-job.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };

describe("recruitment job service", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds scope on create and every read", async () => {
    const create = vi.spyOn(RecruitmentJobModel, "create").mockResolvedValue({ _id: "job-1" } as any);
    const lean = vi.fn().mockResolvedValue({ _id: "job-1" });
    const findOne = vi.spyOn(RecruitmentJobModel, "findOne").mockReturnValue({ lean } as any);
    const sort = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    const find = vi.spyOn(RecruitmentJobModel, "find").mockReturnValue({ sort } as any);

    await createJob(scope, "actor-1", { code: "DEV", title: "Developer" });
    await getJob(scope, "job-1");
    await listJobs(scope, { status: "draft" });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ ...scope, createdBy: "actor-1", updatedBy: "actor-1" }));
    expect(findOne).toHaveBeenCalledWith({ _id: "job-1", ...scope, isDeleted: false });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ ...scope, status: "draft", isDeleted: false }));
  });

  it("validates all publication fields before opening", async () => {
    await expect(createJob(scope, "actor-1", { code: "DEV", status: "open" })).rejects.toThrow("Job is not ready to open");
  });

  it("uses the expected version for updates and reports stale writes", async () => {
    vi.spyOn(RecruitmentJobModel, "findOneAndUpdate").mockResolvedValueOnce(null as any);
    await expect(updateJob(scope, "job-1", 2, "actor-1", { title: "New" })).rejects.toThrow("Job version conflict");
    expect(RecruitmentJobModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "job-1", ...scope, isDeleted: false, version: 2 },
      expect.objectContaining({ $inc: { version: 1 } }),
      { new: true, runValidators: true },
    );
  });

  it("supports scoped close, reopen, soft delete, and restore", async () => {
    const update = vi.spyOn(RecruitmentJobModel, "findOneAndUpdate").mockResolvedValue({ _id: "job-1" } as any);
    await changeJobStatus(scope, "job-1", 0, "actor-1", "closed");
    await changeJobStatus(scope, "job-1", 1, "actor-1", "draft");
    await softDeleteJob(scope, "job-1", 2, "actor-1");
    await restoreJob(scope, "job-1", 3, "actor-1");
    expect(update).toHaveBeenCalledTimes(4);
    expect(update.mock.calls.every(([filter]) => filter.companyCode === "ACME" && filter.branchId === "branch-a")).toBe(true);
  });
});
