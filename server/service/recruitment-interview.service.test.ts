import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentInterviewModel } from "../model/recruitment-interview.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { UserModel } from "../model/user.model";
import { createInterview, updateInterview } from "./recruitment-interview.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
describe("recruitment interview service", () => {
  afterEach(() => vi.restoreAllMocks());
  it("validates every reference in the same branch", async () => {
    vi.spyOn(RecruitmentApplicantModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "app", jobId: "job" }) } as any);
    vi.spyOn(RecruitmentJobModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "job" }) } as any);
    vi.spyOn(UserModel, "countDocuments").mockResolvedValue(1);
    const create = vi.spyOn(RecruitmentInterviewModel, "create").mockImplementation(async (value: any) => value);
    await createInterview(scope, "actor", { applicantId: "app", jobId: "job", interviewerIds: ["user"], scheduledStart: "2030-01-01", scheduledEnd: "2030-01-02", format: "online" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining(scope));
    expect(UserModel.countDocuments).toHaveBeenCalledWith(expect.objectContaining(scope));
  });
  it("rejects stale interview updates", async () => {
    vi.spyOn(RecruitmentInterviewModel, "findOneAndUpdate").mockResolvedValue(null as any);
    await expect(updateInterview(scope, "id", 2, "actor", { notes: "x" })).rejects.toThrow("Interview version conflict");
  });
});
