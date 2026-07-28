import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentPipelineModel } from "../model/recruitment-pipeline.model";
import { getOrCreatePipeline, savePipeline } from "./recruitment-pipeline.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };

describe("recruitment pipeline service", () => {
  afterEach(() => vi.restoreAllMocks());

  it("seeds a default pipeline inside the selected branch", async () => {
    vi.spyOn(RecruitmentPipelineModel, "findOne").mockReturnValue({ lean: async () => null } as any);
    const create = vi.spyOn(RecruitmentPipelineModel, "create").mockImplementation(async (value: any) => value);
    const result: any = await getOrCreatePipeline(scope, "actor-1");
    expect(create).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(result.stages.map((stage: any) => stage.name)).toEqual([
      "New application", "Screening", "Interview", "Offer", "Hired", "Rejected",
    ]);
  });

  it("rejects removal or disabling of a stage containing applicants", async () => {
    vi.spyOn(RecruitmentPipelineModel, "findOne").mockReturnValue({
      lean: async () => ({ version: 1, stages: [{ id: "screen", name: "Screen", isActive: true }] }),
    } as any);
    vi.spyOn(RecruitmentApplicantModel, "exists").mockResolvedValue({ _id: "app-1" } as any);
    await expect(savePipeline(scope, "actor-1", 1, [
      { id: "other", name: "Other", color: "#000000" },
    ])).rejects.toThrow("Pipeline stage is in use");
  });
});
