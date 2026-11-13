import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import XLSX from "xlsx";
import { DOMParser } from "@xmldom/xmldom";
import { assistantDocumentCellAlignment } from "./document-formatting";
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
