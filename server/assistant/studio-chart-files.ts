import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { AssistantError } from "./policy";

export type ChartCell = string | number | boolean | null;
export interface ChartSourceSheet {
  name: string;
  headers: string[];
  rows: Array<Record<string, ChartCell>>;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SHEETS = 8;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_COLUMNS = 40;
const MAX_EXTRACTED_CHARACTERS = 500_000;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function cleanFileName(value: string): string {
  return value.replace(/[\\/\u0000-\u001f]/g, "_").slice(-180) || "du-lieu";
}

function cellText(value: unknown): ChartCell {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().slice(0, 1_000) || null;
  return String(value).trim().slice(0, 1_000) || null;
}

function normalizeTable(name: string, matrix: unknown[][]): ChartSourceSheet | null {
  const rows = matrix
    .map((row) => (Array.isArray(row) ? row.slice(0, MAX_COLUMNS).map(cellText) : []))
    .filter((row) => row.some((cell) => cell !== null));
  if (rows.length < 2) return null;

  const headerIndex = Math.max(0, rows.findIndex((row) => row.filter((cell) => cell !== null).length >= 2));
  const headerRow = rows[headerIndex];
  const width = Math.max(1, ...headerRow.map((_, index) => index + 1).filter((index) => headerRow[index - 1] !== null));
  const headers: string[] = [];
  for (let index = 0; index < width; index += 1) {
    const raw = headerRow[index];
    const base = String(raw ?? `Cột ${index + 1}`).replace(/\s+/g, " ").trim().slice(0, 120) || `Cột ${index + 1}`;
    let header = base;
    let duplicate = 2;
    while (headers.includes(header)) header = `${base} (${duplicate++})`;
    headers.push(header);
  }

  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell !== null));
  if (dataRows.length > MAX_ROWS_PER_SHEET) {
    throw new AssistantError(`Bảng “${name}” có hơn ${MAX_ROWS_PER_SHEET.toLocaleString("vi-VN")} dòng. Hãy chia nhỏ tệp rồi thử lại.`, 413);
  }

  const records = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
  return records.length ? { name: name.slice(0, 120), headers, rows: records } : null;
}

function parseDelimitedText(value: string): unknown[][] {
  const lines = value.replace(/\r/g, "").split("\n").map((line) => line.trimEnd()).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const candidates = ["\t", "|", ";", ","];
  const delimiter = candidates
    .map((candidate) => ({ candidate, scores: lines.slice(0, 12).map((line) => line.split(candidate).length) }))
    .map((item) => ({ ...item, score: item.scores.filter((count) => count >= 2).length, consistency: new Set(item.scores.filter((count) => count >= 2)).size }))
    .sort((a, b) => b.score - a.score || a.consistency - b.consistency)[0];
  if (!delimiter || delimiter.score < 2) {
    const spaced = lines.slice(0, 12).map((line) => line.split(/\t+|\s{2,}/).map((cell) => cell.trim()));
    if (spaced.filter((row) => row.length >= 2).length < 2) return [];
    const width = Math.min(MAX_COLUMNS, Math.max(...spaced.map((row) => row.length)));
    return lines.map((line) => line.split(/\t+|\s{2,}/).slice(0, width).map((cell) => cell.trim()));
  }

  return lines.map((line) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter.candidate && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += char;
    }
    cells.push(cell.trim());
    return cells.slice(0, MAX_COLUMNS);
  });
}

function parseSpreadsheet(buffer: Buffer): ChartSourceSheet[] {
  if (!buffer.subarray(0, 2).equals(Buffer.from("PK")) && !buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
    throw new AssistantError("Tệp Excel không đúng định dạng hoặc bị hỏng.", 422);
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true, sheetRows: MAX_ROWS_PER_SHEET + 2 });
  } catch {
    throw new AssistantError("Không thể đọc bảng tính. Hãy kiểm tra tệp Excel rồi thử lại.", 422);
  }
  if (workbook.SheetNames.length > MAX_SHEETS) throw new AssistantError(`Tệp có quá ${MAX_SHEETS} trang tính. Hãy giữ lại các trang cần vẽ rồi thử lại.`, 413);

  const sheets: ChartSourceSheet[] = [];
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    const range = worksheet?.["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"] as string) : null;
    if (range && range.e.r >= MAX_ROWS_PER_SHEET + 1) {
      throw new AssistantError(`Trang tính “${name}” có hơn ${MAX_ROWS_PER_SHEET.toLocaleString("vi-VN")} dòng. Hãy chia nhỏ tệp rồi thử lại.`, 413);
    }
    if (range && range.e.c >= MAX_COLUMNS) throw new AssistantError(`Trang tính “${name}” có quá ${MAX_COLUMNS} cột. Hãy bỏ các cột không cần thiết rồi thử lại.`, 413);
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: "", blankrows: false }) as unknown[][];
    const sheet = normalizeTable(name, matrix);
    if (sheet) sheets.push(sheet);
  }
  return sheets;
}

function parseDocx(buffer: Buffer): ChartSourceSheet[] {
  let zip: AdmZip;
  try { zip = new AdmZip(buffer); }
  catch { throw new AssistantError("Tệp Word không đúng định dạng DOCX hoặc bị hỏng.", 422); }
  const entries = zip.getEntries();
  const expandedBytes = entries.reduce((sum, entry) => sum + (entry.header.size || 0), 0);
  if (expandedBytes > 100 * 1024 * 1024) throw new AssistantError("Tệp Word giải nén vượt giới hạn xử lý.", 413);
  const documentEntry = zip.getEntry("word/document.xml");
  if (!documentEntry) throw new AssistantError("Không tìm thấy nội dung tài liệu Word.", 422);

  const document = new DOMParser({ onError: (level) => { if (level === "fatalError") throw new Error("Invalid DOCX XML"); } })
    .parseFromString(documentEntry.getData().toString("utf8"), "application/xml");
  const tableNodes = document.getElementsByTagNameNS(WORD_NS, "tbl");
  const sheets: ChartSourceSheet[] = [];
  for (let tableIndex = 0; tableIndex < tableNodes.length && sheets.length < MAX_SHEETS; tableIndex += 1) {
    const rowNodes = (tableNodes.item(tableIndex) as unknown as Element).getElementsByTagNameNS(WORD_NS, "tr");
    const matrix: string[][] = [];
    for (let rowIndex = 0; rowIndex < rowNodes.length; rowIndex += 1) {
      const cellNodes = (rowNodes.item(rowIndex) as unknown as Element).getElementsByTagNameNS(WORD_NS, "tc");
      const row: string[] = [];
      for (let cellIndex = 0; cellIndex < cellNodes.length && cellIndex < MAX_COLUMNS; cellIndex += 1) {
        const textNodes = (cellNodes.item(cellIndex) as unknown as Element).getElementsByTagNameNS(WORD_NS, "t");
        const parts: string[] = [];
        for (let textIndex = 0; textIndex < textNodes.length; textIndex += 1) parts.push(textNodes.item(textIndex)?.textContent || "");
        row.push(parts.join(" ").trim());
      }
      matrix.push(row);
    }
    const sheet = normalizeTable(`Bảng ${tableIndex + 1}`, matrix);
    if (sheet) sheets.push(sheet);
  }
  if (sheets.length) return sheets;

  const paragraphs = document.getElementsByTagNameNS(WORD_NS, "p");
  const lines: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const textNodes = (paragraphs.item(index) as unknown as Element).getElementsByTagNameNS(WORD_NS, "t");
    const parts: string[] = [];
    for (let textIndex = 0; textIndex < textNodes.length; textIndex += 1) parts.push(textNodes.item(textIndex)?.textContent || "");
    lines.push(parts.join(" "));
  }
  const sheet = normalizeTable("Nội dung", parseDelimitedText(lines.join("\n")));
  return sheet ? [sheet] : [];
}

async function parsePdf(buffer: Buffer): Promise<ChartSourceSheet[]> {
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") throw new AssistantError("Tệp PDF không đúng định dạng hoặc bị hỏng.", 422);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getTable() as { pages?: Array<{ num?: number; tables?: unknown[][][] }> };
    const sheets: ChartSourceSheet[] = [];
    for (const page of result.pages || []) {
      for (const table of page.tables || []) {
        const sheet = normalizeTable(`Trang ${page.num || 1} · Bảng ${sheets.length + 1}`, table);
        if (sheet) sheets.push(sheet);
        if (sheets.length >= MAX_SHEETS) break;
      }
      if (sheets.length >= MAX_SHEETS) break;
    }
    if (sheets.length) return sheets;

    const text = await parser.getText();
    const sheet = normalizeTable("Nội dung PDF", parseDelimitedText(String(text?.text || "")));
    return sheet ? [sheet] : [];
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    throw new AssistantError("Không đọc được bảng trong PDF. Tệp PDF scan cần được OCR trước.", 422);
  } finally {
    await parser.destroy();
  }
}

export async function parseStudioChartFile(input: { buffer: Buffer; fileName: string }): Promise<{ fileName: string; sheets: ChartSourceSheet[]; warnings: string[] }> {
  if (!input.buffer.length) throw new AssistantError("Tệp đính kèm đang trống.", 400);
  if (input.buffer.length > MAX_FILE_BYTES) throw new AssistantError("Tệp không được vượt quá 20 MB.", 413);
  const fileName = cleanFileName(input.fileName);
  const extension = fileName.split(".").pop()?.toLocaleLowerCase("en-US");
  let sheets: ChartSourceSheet[];
  if (extension === "csv") {
    const text = input.buffer.toString("utf8").replace(/^\uFEFF/, "");
    sheets = [normalizeTable("CSV", parseDelimitedText(text))].filter((sheet): sheet is ChartSourceSheet => Boolean(sheet));
  } else if (extension === "xlsx" || extension === "xls") {
    sheets = parseSpreadsheet(input.buffer);
  } else if (extension === "docx") {
    if (input.buffer.subarray(0, 2).toString("ascii") !== "PK") throw new AssistantError("Tệp Word không đúng định dạng DOCX hoặc bị hỏng.", 422);
    sheets = parseDocx(input.buffer);
  } else if (extension === "pdf") {
    sheets = await parsePdf(input.buffer);
  } else {
    throw new AssistantError("Chỉ hỗ trợ PDF, Excel (.xlsx, .xls), Word (.docx) và CSV.", 415);
  }

  if (!sheets.length) throw new AssistantError("Không tìm thấy bảng có tiêu đề và dữ liệu trong tệp. Hãy kiểm tra lại hàng tiêu đề.", 422);
  let totalCharacters = 0;
  let totalRows = 0;
  for (const sheet of sheets) {
    totalRows += sheet.rows.length;
    for (const header of sheet.headers) totalCharacters += header.length;
    for (const row of sheet.rows) for (const value of Object.values(row)) totalCharacters += String(value ?? "").length;
  }
  if (totalRows > MAX_ROWS_PER_SHEET * MAX_SHEETS || totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new AssistantError("Tổng dữ liệu trích xuất quá lớn để phân tích an toàn. Hãy chia nhỏ tệp hoặc bỏ bớt cột không cần thiết.", 413);
  }
  return { fileName, sheets, warnings: [] };
}
