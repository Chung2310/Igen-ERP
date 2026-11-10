import { describe, expect, it } from "vitest";
import { isAssistantDocumentRequest, requestedDocumentFormats } from "./documents";

describe("assistant document request routing", () => {
  it.each(["Tạo kế hoạch và xuất Excel", "Xuất file giúp mình", "Cho tôi file PDF", "Tôi cần file Word", "Generate a CSV file", "Đổi sang PDF"])("recognizes %s", question => {
    expect(isAssistantDocumentRequest(question)).toBe(true);
  });
  it.each(["Excel là gì?", "Hướng dẫn xuất file PDF", "Cách tạo file Excel", "Đừng tạo file Word", "Không cần xuất Excel", "Thủ đô của Việt Nam?"])("keeps ordinary questions and negated requests out of file generation: %s", question => {
    expect(isAssistantDocumentRequest(question)).toBe(false);
  });
  it("recognizes contextual revisions only when the conversation already has a document", () => {
    expect(isAssistantDocumentRequest("Thêm cột Ngân sách", true)).toBe(true);
    expect(isAssistantDocumentRequest("Rút gọn còn hai trang", true)).toBe(true);
    expect(isAssistantDocumentRequest("Thêm cột Ngân sách", false)).toBe(false);
    expect(isAssistantDocumentRequest("Cảm ơn", true)).toBe(false);
    expect(isAssistantDocumentRequest("PDF", true)).toBe(true);
    expect(isAssistantDocumentRequest("Tài liệu vừa tạo có những cột nào?", true)).toBe(false);
    expect(isAssistantDocumentRequest("Đừng sửa tài liệu đó", true)).toBe(false);
  });
  it("selects requested output formats, excluding a conversion's source format", () => {
    expect(requestedDocumentFormats("Đổi file Excel sang PDF và Word")).toEqual(["pdf", "docx"]);
    expect(requestedDocumentFormats("Xuất XLSX, Excel và CSV")).toEqual(["xlsx", "csv"]);
  });
});
