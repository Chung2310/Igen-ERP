import path from "node:path";
import Joi from "joi";
import XLSX from "xlsx";
import PizZip from "pizzip";
import PDFDocument from "pdfkit";
import type { AssistantDocumentFormat } from "../../src/shared/assistant-document";
import { AssistantError } from "./policy";
import { renderDocumentWorkbook } from "./document-workbook";

type Cell = string | number | boolean | null;
export interface AssistantDocumentContent {
  title: string;
  sections: { heading: string; text: string }[];
  sheets: { name: string; columns: string[]; rows: Cell[][] }[];
}

const cell = Joi.alternatives().try(Joi.string().allow("").max(4000), Joi.number(), Joi.boolean()).allow(null);
const contentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  sections: Joi.array().max(60).items(Joi.object({ heading: Joi.string().max(200).allow("").required(), text: Joi.string().max(12000).allow("").required() })).required(),
  sheets: Joi.array().max(8).items(Joi.object({
    name: Joi.string().trim().min(1).max(80).required(),
    columns: Joi.array().min(1).max(40).items(Joi.string().trim().min(1).max(200)).required(),
    rows: Joi.array().max(1000).items(Joi.array().max(40).items(cell)).required(),
  })).required(),
}).required();

export function validateDocumentContent(input: unknown): AssistantDocumentContent {
  const result = contentSchema.validate(input, { convert: false, abortEarly: true });
  if (result.error) throw new AssistantError("Nội dung tài liệu chưa hợp lệ. Bạn thử làm rõ yêu cầu rồi tạo lại nhé.", 422);
  const document = result.value as AssistantDocumentContent;
  if (JSON.stringify(document).length > 250_000 || document.sheets.reduce((total, sheet) => total + sheet.rows.length, 0) > 2000) {
    throw new AssistantError("Tài liệu vượt giới hạn 250.000 ký tự hoặc 2.000 dòng. Bạn chia nhỏ yêu cầu nhé.", 422);
  }
  if (!document.sections.some(section => section.text.trim()) && !document.sheets.length) throw new AssistantError("Tài liệu chưa có nội dung để xuất.", 422);
  if (document.sheets.some(sheet => sheet.rows.some(row => row.length !== sheet.columns.length))) throw new AssistantError("Số ô trong bảng chưa khớp với số cột. Bạn thử tạo lại nhé.", 422);
  return document;
}

export const documentMimeTypes: Record<AssistantDocumentFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf", txt: "text/plain;charset=utf-8", md: "text/markdown;charset=utf-8", json: "application/json;charset=utf-8",
};

export function documentFileName(title: string, version: number, format: AssistantDocumentFormat) {
  const name = title.normalize("NFC").replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").replace(/^\.+|\.+$/g, "").trim().slice(0, 100) || "tai-lieu";
  return `${name}-v${version}.${format}`;
}

// Text remains text: model/user input must never become a spreadsheet formula.
const safeCsvCell = (value: Cell) => typeof value === "string" && /^[\s\uFEFF]*[=+@-]/.test(value) ? `'${value}` : value;
const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function documentText(document: AssistantDocumentContent, markdown: boolean) {
  const escapeCell = (value: Cell) => String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return [
    `${markdown ? "# " : ""}${document.title}`,
    ...document.sections.map(section => [section.heading ? `${markdown ? "## " : ""}${section.heading}` : "", section.text].filter(Boolean).join("\n\n")),
    ...document.sheets.map(sheet => [
      `${markdown ? "## " : ""}${sheet.name}`,
      ...(markdown ? [
        `| ${sheet.columns.map(escapeCell).join(" | ")} |`,
        `| ${sheet.columns.map(() => "---").join(" | ")} |`,
        ...sheet.rows.map(row => `| ${row.map(escapeCell).join(" | ")} |`),
      ] : [sheet.columns.join("\t"), ...sheet.rows.map(row => row.map(value => String(value ?? "")).join("\t"))]),
    ].join("\n")),
  ].join("\n\n");
}

function wordDocument(document: AssistantDocumentContent) {
  const paragraph = (text: string, style?: string) => text.split(/\r?\n/).map(line => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join("");
  const table = (sheet: AssistantDocumentContent["sheets"][number]) => {
    const width = 11906 - 2 * 1134;
    const widths = sheet.columns.map((_column, index) => Math.floor(width / sheet.columns.length) + (index < width % sheet.columns.length ? 1 : 0));
    return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(side => `<w:${side} w:val="single" w:sz="4"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map(value => `<w:gridCol w:w="${value}"/>`).join("")}</w:tblGrid>${[sheet.columns, ...sheet.rows].map((row, index) => `<w:tr>${index === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${row.map((value, column) => `<w:tc><w:tcPr><w:tcW w:w="${widths[column]}" w:type="dxa"/></w:tcPr>${paragraph(String(value ?? ""))}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  };
  const body = [paragraph(document.title, "Title"), ...document.sections.flatMap(section => [section.heading ? paragraph(section.heading, "Heading1") : "", paragraph(section.text)]), ...document.sheets.flatMap(sheet => [
    paragraph(sheet.name, "Heading1"),
    table(sheet),
  ])].join("");
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`);
  zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">Trang </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> / </w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:footer="480"/></w:sectPr></w:body></w:document>`);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

async function pdfDocument(document: AssistantDocumentContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: document.title } });
    const chunks: Buffer[] = [];
    let pages = 1;
    pdf.on("data", chunk => chunks.push(Buffer.from(chunk)));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("pageAdded", () => { if (++pages > 150) pdf.destroy(new Error("Tài liệu PDF vượt quá 150 trang.")); });
    pdf.registerFont("Regular", path.resolve("server/assets/fonts/Roboto-Regular.ttf"));
    pdf.registerFont("Bold", path.resolve("server/assets/fonts/Roboto-Bold.ttf"));
    pdf.font("Bold").fontSize(18).text(document.title).moveDown();
    for (const section of document.sections) {
      if (section.heading) {
        const headingHeight = pdf.font("Bold").fontSize(14).heightOfString(section.heading);
        if (pdf.y + headingHeight + 36 > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
        pdf.font("Bold").fontSize(14).text(section.heading).moveDown(0.4);
      }
      pdf.font("Regular").fontSize(11).text(section.text, { lineGap: 3 }).moveDown();
    }
    for (const sheet of document.sheets) {
      const headingHeight = pdf.font("Bold").fontSize(13).heightOfString(sheet.name);
      if (pdf.y + headingHeight + 36 > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
      pdf.font("Bold").fontSize(13).text(sheet.name).moveDown(0.4);
      if (!sheet.rows.length) pdf.font("Regular").fontSize(10).text(sheet.columns.join(" | ")).moveDown();
      // Stacked rows keep wide tables legible on A4 and avoid clipping columns.
      sheet.rows.forEach((row, index) => {
        const rowHeight = pdf.font("Bold").fontSize(11).heightOfString(`${index + 1}.`)
          + row.reduce<number>((height, value, column) => height + pdf.font("Regular").fontSize(10).heightOfString(`${sheet.columns[column]}: ${value ?? ""}`, { lineGap: 2 }), 0) + 12;
        const usableHeight = pdf.page.height - pdf.page.margins.top - pdf.page.margins.bottom;
        if (rowHeight <= usableHeight && pdf.y + rowHeight > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
        pdf.font("Bold").fontSize(11).text(`${index + 1}.`);
        row.forEach((value, column) => pdf.font("Regular").fontSize(10).text(`${sheet.columns[column]}: ${value ?? ""}`, { lineGap: 2 }));
        pdf.moveDown(0.6);
      });
    }
    const range = pdf.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      pdf.switchToPage(page);
      const bottomMargin = pdf.page.margins.bottom;
      // Footers live below the body margin; otherwise PDFKit flows them onto a new page.
      pdf.page.margins.bottom = 0;
      pdf.font("Regular").fontSize(9).text(`Trang ${page + 1} / ${range.count}`, 48, pdf.page.height - 30, { width: pdf.page.width - 96, align: "right", lineBreak: false });
      pdf.page.margins.bottom = bottomMargin;
    }
    pdf.end();
  });
}

export async function renderAssistantDocument(document: AssistantDocumentContent, format: AssistantDocumentFormat): Promise<Buffer> {
  if (format === "docx") return wordDocument(document);
  if (format === "pdf") return pdfDocument(document);
  if (format === "json") return Buffer.from(JSON.stringify(document, null, 2), "utf8");
  if (format === "txt" || format === "md") return Buffer.from(documentText(document, format === "md"), "utf8");
  if (format === "csv") {
    if (document.sheets.length !== 1) throw new AssistantError("CSV cần đúng một bảng dữ liệu. Hãy yêu cầu một bảng hoặc xuất Excel để giữ nhiều sheet.", 422);
    const sheet = document.sheets[0];
    return Buffer.from(`\uFEFF${XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([sheet.columns.map(safeCsvCell), ...sheet.rows.map(row => row.map(safeCsvCell))]), { rawNumbers: true })}`, "utf8");
  }
  return renderDocumentWorkbook(document);
}
