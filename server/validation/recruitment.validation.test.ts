import { describe, expect, it } from "vitest";
import { applicantBodySchema, applicantUpdateBodySchema, jobBodySchema, jobUpdateBodySchema } from "./recruitment.validation";

describe("recruitment document link validation", () => {
  it("accepts public URL metadata on create and update payloads", () => {
    expect(jobBodySchema.validate({ code: "DEV", jdFileUrl: "https://cloud.test/jd.pdf", jdFilePublicId: "folder/jd" }).error).toBeUndefined();
    expect(jobUpdateBodySchema.validate({ version: 1, jdFileUrl: "", jdFilePublicId: "" }).error).toBeUndefined();
    expect(applicantBodySchema.validate({ jobId: "job", fullName: "An", cvUrl: "https://cloud.test/cv.pdf", cvPublicId: "folder/cv" }).error).toBeUndefined();
    expect(applicantUpdateBodySchema.validate({ version: 1, cvUrl: "", cvPublicId: "" }).error).toBeUndefined();
  });
});
