import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { RecruitmentPipelineModel } from "../model/recruitment-pipeline.model";
import { RecruitmentStageHistoryModel } from "../model/recruitment-stage-history.model";
import { createApplicant, transitionApplicant } from "./recruitment-applicant.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };

describe("recruitment applicant service", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns same-branch duplicate warnings before creating", async () => {
    vi.spyOn(RecruitmentJobModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "job-1", status: "open" }) } as any);
    vi.spyOn(RecruitmentPipelineModel, "findOne").mockReturnValue({ lean: async () => ({ stages: [{ id: "new", isActive: true, position: 0 }] }) } as any);
    const find = vi.spyOn(RecruitmentApplicantModel, "find").mockReturnValue({ select: () => ({ lean: async () => [{ _id: "old" }] }) } as any);
    const result = await createApplicant(scope, "actor-1", { jobId: "job-1", fullName: "A", email: " A@EXAMPLE.COM " }, false);
    expect(result).toEqual({ duplicateWarning: true, matches: [{ _id: "old" }] });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      ...scope,
      isDeleted: false,
      $or: [{ normalizedEmail: "a@example.com" }],
    }));
  });

  it("moves applicants with immutable stage snapshots and terminal outcome", async () => {
    vi.spyOn(RecruitmentPipelineModel, "findOne").mockReturnValue({ lean: async () => ({ stages: [
      { id: "new", name: "New", isActive: true },
      { id: "hired", name: "Hired", isActive: true, terminalOutcome: "hired" },
    ] }) } as any);
    vi.spyOn(RecruitmentApplicantModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "app-1", stageId: "new", version: 2 }) } as any);
    vi.spyOn(RecruitmentApplicantModel, "findOneAndUpdate").mockResolvedValue({ _id: "app-1", stageId: "hired" } as any);
    const history = vi.spyOn(RecruitmentStageHistoryModel, "create").mockResolvedValue({} as any);
    await transitionApplicant(scope, "app-1", 2, "actor-1", "hired", "Accepted");
    expect(history).toHaveBeenCalledWith(expect.objectContaining({
      ...scope, fromStageId: "new", fromStageName: "New", toStageId: "hired", toStageName: "Hired", note: "Accepted",
    }));
    expect(RecruitmentApplicantModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "app-1", ...scope, isDeleted: false, version: 2 },
      expect.objectContaining({ $set: expect.objectContaining({ stageId: "hired", outcome: "hired" }), $inc: { version: 1 } }),
      { new: true, runValidators: true },
    );
  });
});
