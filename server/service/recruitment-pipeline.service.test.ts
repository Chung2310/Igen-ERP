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
      "Hồ sơ mới", "Sàng lọc", "Phỏng vấn", "Đề nghị nhận việc", "Đã tuyển", "Từ chối",
    ]);
  });

  it("migrates known English defaults but preserves custom stage names", async () => {
    vi.spyOn(RecruitmentPipelineModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "pipe", version: 2, stages: [{ id: "new", name: "New application", color: "#1", position: 0, isActive: true }, { id: "screening", name: "Duyệt nội bộ", color: "#2", position: 1, isActive: true }] }) } as any);
    const update = vi.spyOn(RecruitmentPipelineModel, "findOneAndUpdate").mockResolvedValue({ _id: "pipe", version: 3, stages: [{ id: "new", name: "Hồ sơ mới" }, { id: "screening", name: "Duyệt nội bộ" }] } as any);
    const result: any = await getOrCreatePipeline(scope, "actor");
    expect(update).toHaveBeenCalledWith({ _id: "pipe", ...scope, isDeleted: false, version: 2 }, expect.objectContaining({ $inc: { version: 1 } }), { returnDocument: 'after', runValidators: true });
    expect(result.stages.map((stage: any) => stage.name)).toEqual(["Hồ sơ mới", "Duyệt nội bộ"]);
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
