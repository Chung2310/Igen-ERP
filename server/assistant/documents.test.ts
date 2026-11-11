import { describe, expect, it } from "vitest";
import { isAssistantDocumentRequest, requestedDocumentFormats, shouldAutoResearchGoldPrices, shouldAutoSearchInformation } from "./documents";

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
  it.each([
    "Viết một hàm JavaScript chuyển dữ liệu sang JSON",
    "Viết đoạn mã Python đọc file Excel",
    "Write a Python script to convert JSON to CSV",
    "Viết ví dụ JSON cho API",
    "Trả lời dưới dạng JSON",
    "Viết kế hoạch học tiếng Anh dưới dạng Markdown",
  ])("answers inline writing and programming requests without generating a download: %s", question => {
    expect(isAssistantDocumentRequest(question)).toBe(false);
    expect(isAssistantDocumentRequest(question, true)).toBe(false);
  });
  it.each([
    "Xuất file Excel có cột tên hàm và ví dụ",
    "Tạo file Excel thực đơn món hầm",
    "Tạo file JSON cấu hình ứng dụng",
    "Tạo file Markdown kế hoạch học tập",
  ])("still generates explicitly requested files: %s", question => {
    expect(isAssistantDocumentRequest(question)).toBe(true);
  });
  it("allows converting an existing document to JSON", () => {
    expect(isAssistantDocumentRequest("Đổi sang JSON", true)).toBe(true);
  });
});

describe("current gold price routing", () => {
  it.each(["Giá vàng hôm nay", "Giá vàng SJC", "Vàng nhẫn 9999 bao nhiêu tiền?"])("automatically researches %s without asking a product clarification", question => {
    expect(shouldAutoResearchGoldPrices(question)).toBe(true);
  });

  it("treats a short answer to a gold price clarification as a request for all common types", () => {
    const messages = [
      { role: "user" as const, content: "giá vàng hôm nay" },
      { role: "assistant" as const, content: "Bạn muốn biết giá vàng SJC, vàng 9999 hay loại nào? Giá mua vào, bán ra hay cả hai?" },
    ];
    expect(shouldAutoResearchGoldPrices("cả 2", messages)).toBe(true);
  });

  it("does not web search unrelated questions about gold", () => {
    expect(shouldAutoResearchGoldPrices("Vàng có ký hiệu hóa học gì?")).toBe(false);
  });
});

describe("automatic information search", () => {
  it.each(["AI là gì?", "Vì sao lãi suất ảnh hưởng giá nhà?", "How do exchange rates work?", "Tìm hiểu thông tin về pin mặt trời", "Lịch sử La Mã"])("searches for information requests: %s", question => {
    expect(shouldAutoSearchInformation(question)).toBe(true);
  });

  it.each(["Viết lời chúc sinh nhật vui vẻ", "Tạo một hình ảnh con mèo", "Dịch đoạn này sang tiếng Anh", "Tóm tắt đoạn văn sau", "Chào bạn", "Cảm ơn"])("keeps pure writing and transformation requests direct: %s", question => {
    expect(shouldAutoSearchInformation(question)).toBe(false);
  });

  it("searches after a brief clarification response to an earlier information question", () => {
    const messages = [
      { role: "user" as const, content: "AI là gì?" },
      { role: "assistant" as const, content: "Bạn muốn tìm hiểu cách AI hoạt động hay các ứng dụng của AI?" },
    ];
    expect(shouldAutoSearchInformation("cả hai", messages)).toBe(true);
  });
});
