import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import XLSX from "xlsx";
import { DOMParser } from "@xmldom/xmldom";
import { PDFDocument } from "pdf-lib";
import { renderAssistantDocument, type AssistantDocumentContent } from "./document-export";
import { verifyAssistantExport } from "./document-preflight";
import { assistantDocumentFormats } from "../../src/shared/assistant-document";

const source: AssistantDocumentContent = { title: "Báo cáo tư vấn", sections: [{ heading: "Ghi chú", text: "Dữ liệu người dùng cung cấp.\nGiữ nguyên 00123." }], sheets: [{ name: "Doanh thu tháng 11", columns: ["Mã", "Giá trị", "Đã duyệt"], rows: [["00123", 1234567.89, true], [null, 0, false]] }] };

describe("assistant export preflight", () => {
  it.each(assistantDocumentFormats)("reopens and verifies a real %s export", async format => {
    const bytes = await renderAssistantDocument(source, format);
    await expect(verifyAssistantExport(source, format, bytes)).resolves.toBeUndefined();
  });
  it.each(assistantDocumentFormats)("rejects invalid %s bytes before saving", async format => {
    await expect(verifyAssistantExport(source, format, Buffer.from("invalid bytes"))).rejects.toThrow("chưa vượt qua kiểm tra");
  });
  it("detects changed spreadsheet values and executable formulas", async () => {
    const original = await renderAssistantDocument(source, "xlsx");
    const workbook = XLSX.read(original, { type: "buffer" });
    workbook.Sheets[source.sheets[0].name].B2.v = 999;
    await expect(verifyAssistantExport(source, "xlsx", XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))).rejects.toThrow("dữ liệu");
    workbook.Sheets[source.sheets[0].name].B2 = { t: "n", v: 1234567.89, f: "1+1" };
    await expect(verifyAssistantExport(source, "xlsx", XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))).rejects.toThrow("dữ liệu");
  });
  it("detects dropped prose and changed Word table data", async () => {
    const bytes = await renderAssistantDocument(source, "docx");
    const zip = new PizZip(bytes);
    zip.file("word/document.xml", zip.file("word/document.xml")!.asText().replace("Giữ nguyên 00123.", "Đã bị mất.").replace("1234567.89", "999"));
    await expect(verifyAssistantExport(source, "docx", zip.generate({ type: "nodebuffer" }))).rejects.toThrow("dữ liệu");
  });
  it("keeps a one-page PDF to one page when adding footer page numbers", async () => {
    const bytes = await renderAssistantDocument(source, "pdf");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("preserves valid tab names and gives only conflicting/invalid tabs deterministic names", async () => {
    const document = { ...source, sheets: [source.sheets[0], { ...source.sheets[0], name: "Nội dung" }, { ...source.sheets[0], name: "Nội dung" }, { ...source.sheets[0], name: "Quý/4:2026" }] };
    const workbook = XLSX.read(await renderAssistantDocument(document, "xlsx"), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Nội dung (3)", "Doanh thu tháng 11", "Nội dung", "Nội dung (2)", "Quý 4 2026"]);
    expect(workbook.Sheets["Doanh thu tháng 11"].A2.v).toBe("00123");
    expect(workbook.Sheets["Doanh thu tháng 11"]["!autofilter"]?.ref).toBe("A1:C3");
    await expect(verifyAssistantExport(document, "xlsx", await renderAssistantDocument(document, "xlsx"))).resolves.toBeUndefined();
  });
  it("writes readable spreadsheet styles, frozen headers and real Word paragraph/table structure", async () => {
    const workbookZip = new PizZip(await renderAssistantDocument(source, "xlsx"));
    const styles = workbookZip.file("xl/styles.xml")!.asText();
    expect(styles).toContain('val="Arial"');
    expect(styles).toContain('wrapText="1"');
    expect(workbookZip.file("xl/worksheets/sheet2.xml")!.asText()).toContain('state="frozen"');
    const wordZip = new PizZip(await renderAssistantDocument(source, "docx"));
    const xml = wordZip.file("word/document.xml")!.asText();
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    const widths = Array.from(parsed.getElementsByTagName("w:gridCol")).map(node => Number(node.getAttribute("w:w")));
    expect(widths.reduce((total, width) => total + width, 0)).toBe(9638);
    expect(xml).not.toContain('w:type="pct"');
    expect(xml).not.toContain("<w:br/>");
    expect(wordZip.file("word/footer1.xml")!.asText()).toContain('w:instr="PAGE"');
    expect(wordZip.file("word/styles.xml")!.asText()).toContain("w:outlineLvl");
  });
});
