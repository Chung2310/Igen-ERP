import XLSX from "xlsx";
import PizZip from "pizzip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { AssistantDocumentContent } from "./document-export";

export function workbookSheetNames(document: AssistantDocumentContent) {
  const used = new Set<string>();
  const unique = (value: string) => {
    const base = value.replace(/[\u0000-\u001f\\/?*\[\]:]/g, " ").trim().replace(/^'+|'+$/g, "").slice(0, 31).replace(/[\uD800-\uDBFF]$/, "") || "Bảng";
    let name = base;
    for (let count = 2; used.has(name.toLowerCase()); count++) {
      const suffix = ` (${count})`;
      name = `${base.slice(0, 31 - suffix.length).replace(/[\uD800-\uDBFF]$/, "")}${suffix}`;
    }
    used.add(name.toLowerCase());
    return name;
  };
  // User-owned table names take priority over the generated notes sheet name.
  const tables = document.sheets.map(sheet => unique(sheet.name));
  return { tables, notes: document.sections.length ? unique("Nội dung") : null };
}

/** Apply presentation to our own generated OOXML; no external workbook is edited here. */
function styleWorkbook(bytes: Buffer): Buffer {
  const zip = new PizZip(bytes);
  const namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const parse = (text: string) => new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(text, "application/xml");
  const serialize = (document: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(document);
  const styles = parse(zip.file("xl/styles.xml")!.asText());
  const fonts = styles.getElementsByTagName("fonts")[0];
  for (const name of Array.from(fonts.getElementsByTagName("name"))) name.setAttribute("val", "Arial");
  for (const scheme of Array.from(fonts.getElementsByTagName("scheme"))) scheme.parentNode!.removeChild(scheme);
  const boldFont = fonts.getElementsByTagName("font")[0].cloneNode(true);
  boldFont.appendChild(styles.createElementNS(namespace, "b"));
  const fontId = fonts.getElementsByTagName("font").length;
  fonts.appendChild(boldFont);
  fonts.setAttribute("count", String(fontId + 1));
  const formats = styles.getElementsByTagName("cellXfs")[0];
  const records = Array.from(formats.getElementsByTagName("xf"));
  for (const record of records) {
    const alignment = styles.createElementNS(namespace, "alignment");
    alignment.setAttribute("wrapText", "1");
    alignment.setAttribute("vertical", "top");
    record.appendChild(alignment);
    record.setAttribute("applyAlignment", "1");
  }
  const header = records[0].cloneNode(true) as typeof records[number];
  header.setAttribute("fontId", String(fontId));
  header.setAttribute("applyFont", "1");
  const headerStyle = records.length;
  formats.appendChild(header);
  formats.setAttribute("count", String(records.length + 1));
  zip.file("xl/styles.xml", serialize(styles));
  for (const entry of zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)) {
    const sheet = parse(entry.asText());
    const firstRow = Array.from(sheet.getElementsByTagName("row")).find(row => row.getAttribute("r") === "1");
    for (const cell of Array.from(firstRow?.getElementsByTagName("c") || [])) cell.setAttribute("s", String(headerStyle));
    let views = sheet.getElementsByTagName("sheetViews")[0];
    if (!views) {
      views = sheet.createElementNS(namespace, "sheetViews");
      const before = sheet.getElementsByTagName("sheetFormatPr")[0] || sheet.getElementsByTagName("cols")[0] || sheet.getElementsByTagName("sheetData")[0];
      sheet.documentElement!.insertBefore(views, before);
    }
    const view = sheet.createElementNS(namespace, "sheetView");
    view.setAttribute("workbookViewId", "0");
    const pane = sheet.createElementNS(namespace, "pane");
    for (const [key, value] of Object.entries({ ySplit: "1", topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" })) pane.setAttribute(key, value);
    view.appendChild(pane);
    while (views.firstChild) views.removeChild(views.firstChild);
    views.appendChild(view);
    zip.file(entry.name, serialize(sheet));
  }
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export function renderDocumentWorkbook(document: AssistantDocumentContent): Buffer {
  const names = workbookSheetNames(document);
  const workbook = XLSX.utils.book_new();
  if (names.notes) {
    const notes = XLSX.utils.aoa_to_sheet([[document.title], ...document.sections.flatMap(section => [[section.heading], [section.text]])]);
    notes["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, notes, names.notes);
  }
  document.sheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.columns, ...sheet.rows]);
    worksheet["!cols"] = sheet.columns.map((label, column) => ({ wch: Math.min(60, Math.max(14, ...[label, ...sheet.rows.map(row => String(row[column] ?? ""))].map(value => Math.max(...value.split(/\r?\n/).map(line => Array.from(line).length))) ) + 2) }));
    worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheet.rows.length, c: sheet.columns.length - 1 } }) };
    XLSX.utils.book_append_sheet(workbook, worksheet, names.tables[index]);
  });
  return styleWorkbook(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
