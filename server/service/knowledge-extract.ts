import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import type { DriveFile } from "./google-drive.service";
import { googleDriveService } from "./google-drive.service";

export type KnowledgeExtractKind = "text" | "spreadsheet";
export interface KnowledgeExtractResult { text: string; kind: KnowledgeExtractKind }

export async function extractKnowledgeText(
  file: Pick<DriveFile, "id" | "name" | "mimeType">,
  accessToken: string,
  drive: Pick<typeof googleDriveService, "downloadFile" | "exportFile"> = googleDriveService,
): Promise<KnowledgeExtractResult> {
  if (file.mimeType === "application/vnd.google-apps.document") return { text: (await drive.exportFile(accessToken, file.id, "text/plain")).toString("utf8"), kind: "text" };
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return { text: (await drive.exportFile(accessToken, file.id, "text/csv")).toString("utf8"), kind: "spreadsheet" };
  if (file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const parser = new PDFParse({ data: await drive.downloadFile(accessToken, file.id) });
    try { return { text: (await parser.getText()).text, kind: "text" }; } finally { await parser.destroy(); }
  }
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name)) {
    const result = await mammoth.extractRawText({ buffer: await drive.downloadFile(accessToken, file.id) });
    return { text: result.value, kind: "text" };
  }
  if (file.mimeType.startsWith("text/") || /\.(md|txt|csv)$/i.test(file.name)) return { text: (await drive.downloadFile(accessToken, file.id)).toString("utf8"), kind: file.mimeType === "text/csv" || /\.csv$/i.test(file.name) ? "spreadsheet" : "text" };
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || /\.xlsx$/i.test(file.name)) {
    const workbook = XLSX.read(await drive.downloadFile(accessToken, file.id), { type: "buffer" });
    return { text: workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join("\n\n"), kind: "spreadsheet" };
  }
  throw new Error(`Định dạng tệp không hỗ trợ: ${file.mimeType || file.name}`);
}
