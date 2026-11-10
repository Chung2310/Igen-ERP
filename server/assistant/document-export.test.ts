import { describe, expect, it } from "vitest";
import XLSX from "xlsx";
import PizZip from "pizzip";
import { PDFParse } from "pdf-parse";
import { documentFileName, renderAssistantDocument, validateDocumentContent, type AssistantDocumentContent } from "./document-export";

const content: AssistantDocumentContent = {
  title: "Kế hoạch tháng 11", sections: [{ heading: "Mục tiêu", text: "Tăng chất lượng tư vấn.\nGiữ nguyên nội dung tiếng Việt & ký tự <đặc biệt>." }],
  sheets: [{ name: "Công việc", columns: ["Nội dung", "Ngân sách", "Hoàn tất"], rows: [["Tư vấn khách hàng", 1250000, false], ["=HYPERLINK(\"https://example.test\")", 0, true]] }],
};

describe("assistant document exports", () => {
  it("creates a real workbook preserving Vietnamese, numbers and strings without formulas", async () => {
    const buffer = await renderAssistantDocument(content, "xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[1]];
    expect(sheet.A2.v).toBe("Tư vấn khách hàng");
    expect(sheet.B2).toMatchObject({ t: "n", v: 1250000 });
    expect(sheet.A3.t).toBe("s");
    expect(sheet.A3.f).toBeUndefined();
  });

  it("neutralizes formula injection in CSV headers and cells, including leading whitespace", async () => {
    const csv = (await renderAssistantDocument({ ...content, sheets: [{ name: "Dữ liệu", columns: ["=header"], rows: [["  @SUM(1,2)"], ["-1+1"], [123]] }] }, "csv")).toString("utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("'=header");
    expect(csv).toContain("'  @SUM(1,2)");
    expect(csv).toContain("'-1+1");
    expect(csv).toContain("123");
  });

  it("refuses to silently discard sheets when exporting CSV", async () => {
    await expect(renderAssistantDocument({ ...content, sheets: [...content.sheets, ...content.sheets] }, "csv")).rejects.toThrow("đúng một bảng");
  });

  it("creates a DOCX package with escaped text, tables, and Vietnamese language metadata", async () => {
    const archive = new PizZip(await renderAssistantDocument(content, "docx"));
    const document = archive.file("word/document.xml")!.asText();
    expect(document).toContain("Kế hoạch tháng 11");
    expect(document).toContain("&amp;");
    expect(document).toContain("&lt;đặc biệt&gt;");
    expect(document).toContain("<w:tbl>");
    expect(archive.file("word/styles.xml")!.asText()).toContain("vi-VN");
    expect(archive.file("[Content_Types].xml")).toBeTruthy();
  });

  it("renders a readable PDF with Vietnamese content and an embedded font", async () => {
    const buffer = await renderAssistantDocument(content, "pdf");
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      expect(result.text).toContain("Kế hoạch tháng 11");
      expect(result.text).toContain("Tư vấn khách hàng");
    } finally { await parser.destroy(); }
  });

  it.each(["txt", "md", "json"] as const)("exports full content as %s without chat reply truncation", async format => {
    const document = { ...content, sections: [{ heading: "Nội dung", text: "Nội dung đầy đủ. ".repeat(500) }] };
    const output = (await renderAssistantDocument(document, format)).toString("utf8");
    expect(output.length).toBeGreaterThan(6000);
    if (format === "json") expect(JSON.parse(output)).toEqual(document);
    else expect(output).toContain(document.sections[0].text);
  });

  it("rejects malformed tables, executable cell objects, unknown properties and oversized content", () => {
    expect(() => validateDocumentContent({ ...content, sheets: [{ name: "Test", columns: ["A"], rows: [[1, 2]] }] })).toThrow("số cột");
    expect(() => validateDocumentContent({ ...content, sheets: [{ name: "Test", columns: ["A"], rows: [[{ f: "WEBSERVICE()" }]] }] })).toThrow("chưa hợp lệ");
    expect(() => validateDocumentContent({ ...content, filePath: "../../.env" })).toThrow("chưa hợp lệ");
    expect(() => validateDocumentContent({ ...content, sections: Array.from({ length: 30 }, () => ({ heading: "", text: "a".repeat(10000) })) })).toThrow("250.000");
  });

  it("produces safe versioned download filenames", () => {
    const fileName = documentFileName("../../Mẫu: kế hoạch\r\n<>|", 2, "pdf");
    expect(fileName).not.toMatch(/[\\/:*?"<>|\r\n]/);
    expect(fileName).toContain("Mẫu kế hoạch-v2.pdf");
  });
});
