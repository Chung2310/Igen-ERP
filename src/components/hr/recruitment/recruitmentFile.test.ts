import { describe, expect, it } from "vitest";
import { validateRecruitmentFile } from "./recruitmentFile";

describe("validateRecruitmentFile", () => {
  it("accepts PDF, DOC, and DOCX files up to 10 MB", () => {
    expect(
      validateRecruitmentFile(
        new File(["pdf"], "jd.pdf", { type: "application/pdf" }),
      ),
    ).toBe("");
    expect(
      validateRecruitmentFile(
        new File(["doc"], "cv.doc", { type: "application/msword" }),
      ),
    ).toBe("");
    expect(
      validateRecruitmentFile(
        new File(["docx"], "cv.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ),
    ).toBe("");
  });

  it("rejects unsupported or oversized files", () => {
    expect(
      validateRecruitmentFile(
        new File(["text"], "cv.txt", { type: "text/plain" }),
      ),
    ).toContain("PDF, DOC");
    const oversized = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "cv.pdf",
      { type: "application/pdf" },
    );
    expect(validateRecruitmentFile(oversized)).toContain("10 MB");
  });
});
