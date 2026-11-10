import { describe, expect, it } from "vitest";
import { DOCUMENT_RULES_VERSION, documentCreationRules, documentRuleSources } from "./document-rules";

describe("assistant file creation rules", () => {
  it("loads common rules and only the requested format guidance", () => {
    const rules = documentCreationRules(["xlsx", "xlsx"]);
    expect(rules).toContain("QUY ƯỚC TÀI LIỆU IGEN");
    expect(rules).toContain("Giữ chính xác tên sheet");
    expect(rules).toContain("Ứng dụng chưa có bộ tính công thức");
    expect(rules.match(/BẢNG TÍNH/g)).toHaveLength(1);
    expect(rules).not.toContain("WORD\n");
    expect(rules).not.toContain("PDF\n");
  });
  it("keeps unsupported capabilities explicit and CSV/JSON contracts honest", () => {
    expect(documentCreationRules(["csv"])).toContain("Không tạo công thức dạng chuỗi");
    expect(documentCreationRules(["csv"])).toContain("không nhét ghi chú vào dòng dữ liệu");
    expect(documentCreationRules(["json"])).toContain("schema khác");
    expect(documentCreationRules(["pdf"])).toContain("không nói đã kiểm tra trực quan");
  });
  it("records reviewed official sources and a version for generated artifacts", () => {
    expect(DOCUMENT_RULES_VERSION).toContain("2026-11-10");
    expect(documentRuleSources).toHaveLength(4);
    for (const source of documentRuleSources) expect(source.url).toMatch(/^https:\/\/github\.com\/(?:anthropics|openai)\/skills\//);
  });
});
