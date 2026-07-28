import { describe, expect, it } from "vitest";
import { RecruitmentApplicantModel } from "./recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "./recruitment-attachment.model";
import { RecruitmentInterviewModel } from "./recruitment-interview.model";
import { RecruitmentJobModel } from "./recruitment-job.model";
import { RecruitmentPipelineModel } from "./recruitment-pipeline.model";
import { RecruitmentStageHistoryModel } from "./recruitment-stage-history.model";

const models = [
  RecruitmentJobModel,
  RecruitmentPipelineModel,
  RecruitmentApplicantModel,
  RecruitmentStageHistoryModel,
  RecruitmentInterviewModel,
  RecruitmentAttachmentModel,
];

function indexes(model: (typeof models)[number]) {
  return model.schema.indexes().map(([fields, options]) => ({ fields, options }));
}

describe("recruitment model schemas", () => {
  it.each(models)("requires branch scope and audit metadata on $modelName", (model) => {
    expect(model.schema.path("companyCode")?.options.required).toBe(true);
    expect(model.schema.path("branchId")?.options.required).toBe(true);
    expect(model.schema.path("version")?.options.default).toBe(0);
    expect(model.schema.path("isDeleted")?.options.default).toBe(false);
    expect(model.schema.path("deletedAt")).toBeDefined();
    expect(model.schema.path("deletedBy")).toBeDefined();
  });

  it("enforces branch-unique active job codes and job lifecycle enums", () => {
    expect(RecruitmentJobModel.schema.path("status")?.options.enum).toEqual([
      "draft",
      "open",
      "paused",
      "closed",
    ]);
    expect(indexes(RecruitmentJobModel)).toContainEqual({
      fields: { companyCode: 1, branchId: 1, code: 1 },
      options: {
        unique: true,
        partialFilterExpression: { isDeleted: false },
      },
    });
  });

  it("stores stable pipeline stage IDs and one pipeline per branch", () => {
    const stages = RecruitmentPipelineModel.schema.path("stages") as any;
    expect(stages.schema.path("id")?.options.required).toBe(true);
    expect(stages.schema.path("terminalOutcome")?.options.enum).toEqual([
      "hired",
      "rejected",
      "withdrawn",
      null,
    ]);
    expect(indexes(RecruitmentPipelineModel)).toContainEqual({
      fields: { companyCode: 1, branchId: 1 },
      options: { unique: true },
    });
  });

  it("indexes applicant board filters and normalized duplicate fields", () => {
    expect(RecruitmentApplicantModel.schema.path("outcome")?.options.enum).toEqual([
      "active",
      "hired",
      "rejected",
      "withdrawn",
    ]);
    expect(indexes(RecruitmentApplicantModel)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fields: {
            companyCode: 1,
            branchId: 1,
            jobId: 1,
            stageId: 1,
            outcome: 1,
            recruiterId: 1,
            createdAt: -1,
          },
        }),
        expect.objectContaining({
          fields: { companyCode: 1, branchId: 1, normalizedEmail: 1 },
        }),
        expect.objectContaining({
          fields: { companyCode: 1, branchId: 1, normalizedPhone: 1 },
        }),
      ]),
    );
  });

  it("indexes immutable history and interview chronology within a branch", () => {
    expect(indexes(RecruitmentStageHistoryModel)).toContainEqual(
      expect.objectContaining({
        fields: { companyCode: 1, branchId: 1, applicantId: 1, createdAt: 1 },
      }),
    );
    expect(RecruitmentInterviewModel.schema.path("status")?.options.enum).toEqual([
      "scheduled",
      "completed",
      "cancelled",
    ]);
    expect(indexes(RecruitmentInterviewModel)).toContainEqual(
      expect.objectContaining({
        fields: { companyCode: 1, branchId: 1, scheduledStart: 1, status: 1 },
      }),
    );
  });

  it("stores private attachment metadata without a public URL", () => {
    expect(RecruitmentAttachmentModel.schema.path("ownerType")?.options.enum).toEqual(["job", "applicant"]);
    expect(RecruitmentAttachmentModel.schema.path("ownerId")?.options.required).toBe(true);
    expect(RecruitmentAttachmentModel.schema.path("applicantId")).toBeUndefined();
    expect(RecruitmentAttachmentModel.schema.path("storageKey")?.options.required).toBe(true);
    expect(RecruitmentAttachmentModel.schema.path("mimeType")?.options.required).toBe(true);
    expect(RecruitmentAttachmentModel.schema.path("size")?.options.required).toBe(true);
    expect(RecruitmentAttachmentModel.schema.path("url")).toBeUndefined();
    expect(indexes(RecruitmentAttachmentModel)).toContainEqual(
      expect.objectContaining({
        fields: { companyCode: 1, branchId: 1, ownerType: 1, ownerId: 1 },
        options: { unique: true, partialFilterExpression: { isDeleted: false } },
      }),
    );
  });

  it("stores public JD and CV link metadata on their owners", () => {
    for (const field of ["jdFileUrl", "jdFilePublicId"]) expect(RecruitmentJobModel.schema.path(field)?.options.default).toBe("");
    for (const field of ["cvUrl", "cvPublicId"]) expect(RecruitmentApplicantModel.schema.path(field)?.options.default).toBe("");
  });
});
