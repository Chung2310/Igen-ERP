import XLSX from "xlsx";
import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";
import { PDFDocument } from "pdf-lib";
import type { AssistantDocumentFormat } from "../../src/shared/assistant-document";
import type { AssistantDocumentContent } from "./document-export";
import { workbookSheetNames } from "./document-workbook";
import { AssistantError } from "./policy";

/** Reopen bytes before persistence. This verifies structure/data, not visual layout. */
export async function verifyAssistantExport(document: AssistantDocumentContent, format: AssistantDocumentFormat, bytes: Buffer): Promise<void> {
  try {
    if (!bytes.length) throw new Error("empty");
    if (format === "xlsx") {
      const workbook = XLSX.read(bytes, { type: "buffer", cellFormula: true });
      for (const name of workbook.SheetNames) {
        for (const [address, cell] of Object.entries(workbook.Sheets[name])) {
          if (!address.startsWith("!") && (cell?.f || cell?.t === "e")) throw new Error("formula/error cell");
        }
      }
      const names = workbookSheetNames(document);
      if (JSON.stringify(workbook.SheetNames) !== JSON.stringify([...(names.notes ? [names.notes] : []), ...names.tables])) throw new Error("sheet names");
      document.sheets.forEach((source, index) => {
        const sheet = workbook.Sheets[names.tables[index]];
        [source.columns, ...source.rows].forEach((row, r) => row.forEach((value, c) => {
          const cell = sheet[XLSX.utils.encode_cell({ r, c })];
          if ((cell?.v ?? null) !== value || cell?.f || cell?.t === "e") throw new Error("cell data");
        }));
      });
      if (names.notes) {
        [document.title, ...document.sections.flatMap(section => [section.heading, section.text])].forEach((value, row) => {
          if ((workbook.Sheets[names.notes!][`A${row + 1}`]?.v ?? "") !== value) throw new Error("notes");
        });
      }
    } else if (format === "docx") {
      const zip = new PizZip(bytes);
      if (!zip.file("[Content_Types].xml") || !zip.file("_rels/.rels")) throw new Error("package");
      const xml = zip.file("word/document.xml")?.asText();
      if (!xml) throw new Error("document");
      const parsed = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(xml, "application/xml");
      const split = (value: unknown) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").split(/\r?\n/);
      const expected = [
        ...split(document.title),
        ...document.sections.flatMap(section => [...(section.heading ? split(section.heading) : []), ...split(section.text)]),
        ...document.sheets.flatMap(sheet => [...split(sheet.name), ...[sheet.columns, ...sheet.rows].flatMap(row => row.flatMap(split))]),
      ];
      const actual = Array.from(parsed.getElementsByTagName("w:t")).map(node => node.textContent || "");
      if (parsed.documentElement?.localName !== "document" || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("document text");
    } else if (format === "pdf") {
      if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("signature");
      const pdf = await PDFDocument.load(bytes);
      if (pdf.getPageCount() < 1 || pdf.getPageCount() > 150 || pdf.getTitle() !== document.title) throw new Error("pages/title");
    } else if (format === "json") {
      if (JSON.stringify(JSON.parse(bytes.toString("utf8"))) !== JSON.stringify(document)) throw new Error("json data");
    } else if (format === "csv") {
      if (document.sheets.length !== 1 || bytes.subarray(0, 3).toString("hex") !== "efbbbf") throw new Error("csv structure");
      const workbook = XLSX.read(bytes, { type: "buffer", raw: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      [document.sheets[0].columns, ...document.sheets[0].rows].forEach((row, r) => row.forEach((value, c) => {
        const safe = typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(value) ? `'${value}` : typeof value === "boolean" ? String(value).toUpperCase() : String(value ?? "");
        if (String(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? "") !== safe) throw new Error("csv data");
      }));
    } else {
      const text = bytes.toString("utf8");
      if (!text.includes(document.title) || !Buffer.from(text, "utf8").equals(bytes)) throw new Error("text encoding/title");
    }
  } catch {
    throw new AssistantError("Tệp vừa tạo chưa vượt qua kiểm tra cấu trúc hoặc dữ liệu. Bạn thử tạo lại nhé.", 422);
  }
}
