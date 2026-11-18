import { describe, expect, it } from "vitest";
import { projectEvidenceExcerpt } from "./project-evidence";
describe("project evidence excerpts", () => {
  it("finds relevant evidence beyond the beginning of a long document", () => {
    const document = "x".repeat(3600) + "Quy trình tiếp nhận nhân viên: giao người hướng dẫn.";
    expect(projectEvidenceExcerpt(document, "tiếp nhận nhân viên", 1200)).toContain("giao người hướng dẫn");
  });
  it("bounds context and retains exact wording", () => {
    expect(projectEvidenceExcerpt("Nội dung gốc", "", 100)).toBe("Nội dung gốc");
    expect(projectEvidenceExcerpt("a".repeat(5000), "tìm kiếm", 1300)).toHaveLength(1300);
  });
});
