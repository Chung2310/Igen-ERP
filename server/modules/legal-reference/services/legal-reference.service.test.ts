import { describe, expect, it } from "vitest";
import { embedLegalText, isLegalChunkApplicable, legalEmbeddingSimilarity, scoreLegalMatch, splitLegalStructure } from "./legal-reference.service";

describe("legal reference retrieval primitives", () => {
  it("keeps chapter, article, clause and point context on searchable segments", () => {
    const chunks = splitLegalStructure([
      "CHƯƠNG I QUY ĐỊNH CHUNG",
      "Điều 1. Phạm vi điều chỉnh",
      "1. Luật này quy định nguyên tắc quản lý.",
      "a) Cơ quan nhà nước có trách nhiệm thực hiện.",
      "Điều 2. Đối tượng áp dụng",
      "Tổ chức và cá nhân có liên quan.",
    ].join("\n"));

    expect(chunks).toHaveLength(4);
    expect(chunks[2]).toMatchObject({ chapter: "CHƯƠNG I QUY ĐỊNH CHUNG", article: "Điều 1", clause: "1", point: "a" });
    expect(chunks[2].text).toContain("Cơ quan nhà nước");
    expect(chunks[3]).toMatchObject({ article: "Điều 2", clause: "", point: "" });
  });

  it("does not guess a legal structure when article markers are absent", () => {
    expect(splitLegalStructure("Nội dung văn bản không có tiêu đề Điều rõ ràng.")).toEqual([]);
  });

  it("matches accented Vietnamese queries against normalized text", () => {
    expect(scoreLegalMatch("trách nhiệm cơ quan nhà nước", "Cơ quan nhà nước có trách nhiệm thực hiện.")).toBeGreaterThan(0.9);
    expect(scoreLegalMatch("quyền sở hữu", "Trách nhiệm quản lý nhà nước.")).toBe(0);
  });

  it("creates stable normalized embeddings so accents do not split the same legal terms", () => {
    const accented = embedLegalText("Trách nhiệm của cơ quan nhà nước");
    expect(accented).toHaveLength(96);
    expect(accented).toEqual(embedLegalText("Trach nhiem cua co quan nha nuoc"));
    expect(legalEmbeddingSimilarity(accented, embedLegalText("trách nhiệm cơ quan"))).toBeGreaterThan(0.4);
  });

  it("extracts paragraph boundaries from VBPL HTML snapshots before legal chunking", async () => {
    const { extractLegalText } = await import("./legal-reference.service");
    const text = await extractLegalText(Buffer.from("<p>CHƯƠNG I</p><p>Điều 1. Phạm vi</p><p>1. Áp dụng &amp; thực hiện.</p>"), "law.html");
    expect(text).toContain("Điều 1. Phạm vi");
    expect(splitLegalStructure(text)).toMatchObject([
      { article: "Điều 1", clause: "", text: "Phạm vi" },
      { article: "Điều 1", clause: "1", text: "Áp dụng & thực hiện." },
    ]);
  });

  it("resolves historical applicability from effective dates, including a repealed document before its end date", () => {
    expect(isLegalChunkApplicable({ status: "repealed", effectiveFrom: "2020-01-01", effectiveTo: "2024-12-31" }, new Date("2023-05-01"))).toBe(true);
    expect(isLegalChunkApplicable({ status: "repealed", effectiveFrom: "2020-01-01", effectiveTo: "2024-12-31" }, new Date("2025-01-01"))).toBe(false);
    expect(isLegalChunkApplicable({ status: "unknown" }, new Date("2023-05-01"))).toBe(false);
    expect(isLegalChunkApplicable({ status: "upcoming", effectiveFrom: "2026-01-01" }, new Date("2025-12-31"))).toBe(false);
    expect(isLegalChunkApplicable({ status: "upcoming", effectiveFrom: "2026-01-01" }, new Date("2026-01-01"))).toBe(true);
  });
});
