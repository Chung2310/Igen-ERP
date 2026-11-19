import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import XLSX from "xlsx";
import { DOMParser } from "@xmldom/xmldom";
import { assistantDocumentCellAlignment, assistantDocumentParagraphAlignment } from "./document-formatting";
import { renderAssistantDocument, validateDocumentContent, type AssistantDocumentContent } from "./document-export";

const document: AssistantDocumentContent = {
  title: "Theo dõi công việc",
  titleAlignment: "center",
  sections: [
    { heading: "Tổng quan", text: "Báo cáo theo dõi tiến độ." },
    { heading: "Trường hợp đặc biệt", text: "Ngoại lệ đã được xác nhận.", alignment: "center" },
  ],
  sheets: [{
    name: "Công việc",
    columns: ["STT", "Tên công việc", "Ngày thực hiện", "Trạng thái", "Số tiền", "Đã duyệt", "Trường hợp đặc biệt"],
    rows: [[1, "Chuẩn bị hồ sơ", "2026-11-13", "Hoàn thành", 250000, true, "Ngoại lệ"]],
    headerAlignments: [null, null, "center", null, null, null, null],
    columnAlignments: ["center", null, null, "center", null, null, "right"],
    cellAlignments: [[null, "center", null, null, null, null, "center"]],
  }],
};

describe("assistant document formatting", () => {
  it.each(["ĐƠN XIN NGHỈ PHÉP", "BIÊN BẢN HỌP", "CÔNG VĂN", "BÁO CÁO THÁNG", "KẾ HOẠCH KINH DOANH"])("automatically formats structural lines of %s", title => {
    expect(assistantDocumentParagraphAlignment(title, title, undefined, true)).toBe("center");
    expect(assistantDocumentParagraphAlignment(title, "Độc lập – Tự do – Hạnh phúc")).toBe("center");
    expect(assistantDocumentParagraphAlignment(title, "Hà Nội, ngày 19 tháng 11 năm 2026")).toBe("right");
    expect(assistantDocumentParagraphAlignment(title, "Hôm nay ngày 19 tháng 11 năm 2026, chúng tôi họp.")).toBeUndefined();
    expect(assistantDocumentParagraphAlignment(title, "Nội dung có chữ quốc hiệu trong câu.")).toBeUndefined();
  });

  it("renders section roles while preserving explicit overrides and content", async () => {
    const input = validateDocumentContent({ title: "Báo cáo dự án", sections: [
      { heading: "", text: "Người phụ trách dự án", role: "signature" },
      { heading: "", text: "Ngày lập: 19/11/2026", role: "date" },
      { heading: "Tiến độ", text: "Nội dung báo cáo", role: "body" },
      { heading: "", text: "Phụ đề riêng", role: "subtitle", alignment: "left" },
    ], sheets: [] });
    const before = JSON.stringify(input);
    const zip = new PizZip(await renderAssistantDocument(input, "docx"));
    const xml = new DOMParser().parseFromString(zip.file("word/document.xml")!.asText(), "application/xml");
    const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
    const align = (text: string) => paragraphs.find(p => p.textContent === text)?.getElementsByTagName("w:jc")[0]?.getAttribute("w:val");
    expect(align("Báo cáo dự án")).toBe("center");
    expect(align("Người phụ trách dự án")).toBe("center");
    expect(align("Ngày lập: 19/11/2026")).toBe("right");
    expect(align("Nội dung báo cáo")).toBe("left");
    expect(align("Phụ đề riêng")).toBe("left");
    expect(JSON.stringify(input)).toBe(before);
    expect(() => validateDocumentContent({ ...input, sections: [{ heading: "", text: "X", role: "unknown" }] })).toThrow();
  });

  it("formats numeric spreadsheet cells without converting identifiers, dates or formula-like text", async () => {
    const input: AssistantDocumentContent = { title: "Danh sách", sections: [], sheets: [{ name: "Dữ liệu", columns: ["Mã", "Số tiền", "Ngày", "Nội dung", "Duyệt"], rows: [["00123", 1234567, "2026-11-19", "=1+1", true]] }] };
    const bytes = await renderAssistantDocument(input, "xlsx");
    const zip = new PizZip(bytes);
    const workbook = XLSX.read(bytes, { type: "buffer", cellStyles: true });
    const sheet = workbook.Sheets["Dữ liệu"];
    expect(sheet.A2.v).toBe("00123");
    expect(sheet.C2.v).toBe("2026-11-19");
    expect(sheet.D2.v).toBe("=1+1");
    expect(sheet.D2.f).toBeUndefined();
    expect(sheet.B2.v).toBe(1234567);
    expect(sheet.B2.z).toBe("#,##0");
    const xml = new DOMParser().parseFromString(zip.file("xl/worksheets/sheet1.xml")!.asText(), "application/xml");
    const styles = new DOMParser().parseFromString(zip.file("xl/styles.xml")!.asText(), "application/xml");
    const xfs = Array.from(styles.getElementsByTagName("cellXfs")[0].getElementsByTagName("xf"));
    const align = (address: string) => {
      const cell = Array.from(xml.getElementsByTagName("c")).find(c => c.getAttribute("r") === address)!;
      return xfs[Number(cell.getAttribute("s") || 0)].getElementsByTagName("alignment")[0]?.getAttribute("horizontal");
    };
    expect(align("A1")).toBe("center");
    expect(align("B2")).toBe("right");
    expect(align("E2")).toBe("center");
    expect(assistantDocumentCellAlignment(["left"], undefined, 0, 0, 100)).toBe("left");
    expect(assistantDocumentCellAlignment([null], undefined, 0, 0, 100)).toBeUndefined();
  });

  it("centers contract masthead and signatures without centering adjacent body paragraphs or table cells", async () => {
    const contract: AssistantDocumentContent = { title: "HỢP ĐỒNG LAO ĐỘNG", sections: [
      { heading: "", text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc\nSố: 01/HĐLĐ\nHôm nay, hai bên gồm:" },
      { heading: "Điều 1. Công việc", text: "Người lao động làm việc tại công ty." },
      { heading: "NGƯỜI LAO ĐỘNG", text: "(Ký, ghi rõ họ tên)" },
      { heading: "NGƯỜI SỬ DỤNG LAO ĐỘNG", text: "(Ký, ghi rõ họ tên, đóng dấu)" },
    ], sheets: [{ name: "Thông tin", columns: ["BÊN A"], rows: [["NGƯỜI LAO ĐỘNG"]] }] };
    const zip = new PizZip(await renderAssistantDocument(validateDocumentContent(contract), "docx"));
    const xml = new DOMParser().parseFromString(zip.file("word/document.xml")!.asText(), "application/xml");
    const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
    const matches = (text: string) => paragraphs.filter(p => Array.from(p.getElementsByTagName("w:t")).map(node => node.textContent).join("") === text);
    const alignment = (p: typeof paragraphs[number]) => p.getElementsByTagName("w:jc")[0]?.getAttribute("w:val") || "left";
    for (const text of [contract.title, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập – Tự do – Hạnh phúc", "NGƯỜI SỬ DỤNG LAO ĐỘNG", "(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên, đóng dấu)"]) expect(alignment(matches(text)[0])).toBe("center");
    for (const text of ["Số: 01/HĐLĐ", "Hôm nay, hai bên gồm:", "Điều 1. Công việc", "Người lao động làm việc tại công ty."]) expect(alignment(matches(text)[0])).toBe("left");
    expect(alignment(matches("BÊN A")[0])).toBe("center");
    expect(matches("NGƯỜI LAO ĐỘNG").map(alignment)).toEqual(["center", "left"]);
  });

  it("preserves explicit alignment and does not infer formatting for other document types or clause sentences", () => {
    expect(assistantDocumentParagraphAlignment("HỢP ĐỒNG LAO ĐỘNG", "HỢP ĐỒNG LAO ĐỘNG", "left", true)).toBe("left");
    expect(assistantDocumentParagraphAlignment("HỢP ĐỒNG LAO ĐỘNG", "NGƯỜI LAO ĐỘNG", "right")).toBe("right");
    expect(assistantDocumentParagraphAlignment("HỢP ĐỒNG LAO ĐỘNG", "NGƯỜI LAO ĐỘNG", null)).toBeUndefined();
    expect(assistantDocumentParagraphAlignment("Báo cáo nhân sự", "NGƯỜI LAO ĐỘNG")).toBeUndefined();
    expect(assistantDocumentParagraphAlignment("HỢP ĐỒNG LAO ĐỘNG", "NGƯỜI LAO ĐỘNG có trách nhiệm bảo mật.")).toBeUndefined();
  });

  it("requires alignment metadata to match the referenced headings, columns, and rows", () => {
    expect(() => validateDocumentContent({ ...document, sheets: [{ ...document.sheets[0], cellAlignments: [] }] })).toThrow("Thông tin căn lề");
    expect(() => validateDocumentContent({ ...document, sheets: [{ ...document.sheets[0], headerAlignments: ["center"] }] })).toThrow("Thông tin căn lề");
    expect(validateDocumentContent(document).sheets[0].cellAlignments).toHaveLength(1);
  });

  it("uses a cell alignment before the column default without inferring from labels or values", () => {
    expect(assistantDocumentCellAlignment(["right"], [["center"]], 0, 0)).toBe("center");
    expect(assistantDocumentCellAlignment(["right"], [[null]], 0, 0)).toBe("right");
    expect(assistantDocumentCellAlignment(["right"], undefined, 0, 0)).toBe("right");
    expect(assistantDocumentCellAlignment(undefined, undefined, 0, 0)).toBeUndefined();
  });

  it("applies only the requested title, section, header, column, and cell alignments in XLSX", async () => {
    const bytes = await renderAssistantDocument(document, "xlsx");
    const zip = new PizZip(bytes);
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const notesName = workbook.SheetNames[0];
    const tableName = workbook.SheetNames[1];
    const sheetFile = (index: number) => zip.file(`xl/worksheets/sheet${index}.xml`)!.asText();
    const styles = new DOMParser().parseFromString(zip.file("xl/styles.xml")!.asText(), "application/xml");
    const xfs = Array.from(styles.getElementsByTagName("cellXfs")[0].getElementsByTagName("xf"));
    const cellAlignment = (xml: string, address: string) => {
      const cell = Array.from(new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("c"))
        .find(item => item.getAttribute("r") === address);
      const styleId = Number(cell?.getAttribute("s") || 0);
      return xfs[styleId]?.getElementsByTagName("alignment")[0]?.getAttribute("horizontal") || "";
    };

    expect(notesName).toBe("Nội dung");
    expect(tableName).toBe("Công việc");
    expect(cellAlignment(sheetFile(1), "A1")).toBe("center");
    expect(cellAlignment(sheetFile(1), "A2")).not.toBe("center");
    expect(cellAlignment(sheetFile(1), "A3")).not.toBe("center");
    expect(cellAlignment(sheetFile(1), "A4")).toBe("center");
    expect(cellAlignment(sheetFile(1), "A5")).toBe("center");
    expect(cellAlignment(sheetFile(2), "A1")).not.toBe("center");
    expect(cellAlignment(sheetFile(2), "A2")).toBe("center");
    expect(cellAlignment(sheetFile(2), "B1")).not.toBe("center");
    expect(cellAlignment(sheetFile(2), "B2")).toBe("center");
    expect(cellAlignment(sheetFile(2), "C1")).toBe("center");
    expect(cellAlignment(sheetFile(2), "C2")).not.toBe("center");
    expect(cellAlignment(sheetFile(2), "D2")).toBe("center");
    expect(cellAlignment(sheetFile(2), "E2")).not.toBe("center");
    expect(cellAlignment(sheetFile(2), "F2")).not.toBe("center");
    expect(cellAlignment(sheetFile(2), "G2")).toBe("center");
  });

  it("applies explicit alignment metadata to Word paragraphs and cells", async () => {
    const zip = new PizZip(await renderAssistantDocument(document, "docx"));
    const xml = new DOMParser().parseFromString(zip.file("word/document.xml")!.asText(), "application/xml");
    const paragraphs = Array.from(xml.getElementsByTagName("w:p"));
    const paragraphFor = (text: string) => paragraphs.find(paragraph => Array.from(paragraph.getElementsByTagName("w:t")).map(node => node.textContent).join("") === text)!;
    const alignment = (text: string) => paragraphFor(text).getElementsByTagName("w:jc")[0]?.getAttribute("w:val") || "left";

    expect(alignment(document.title)).toBe("center");
    expect(alignment("Tổng quan")).toBe("left");
    expect(alignment("Trường hợp đặc biệt")).toBe("center");
    expect(alignment("Ngoại lệ đã được xác nhận.")).toBe("center");
    expect(alignment("Trạng thái")).toBe("left");
    expect(alignment("Hoàn thành")).toBe("center");
    expect(alignment("Tên công việc")).toBe("left");
    expect(alignment("Báo cáo theo dõi tiến độ.")).toBe("left");
  });
});
