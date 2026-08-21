import { createHash } from "crypto";
import { KnowledgeChunkModel, KnowledgeDocumentModel } from "../model/knowledge.model";
import { embeddingProvider } from "./knowledge-embedding";
import { CompanyModel } from "../model/company.model";
import { googleOAuthService } from "./google-oauth.service";
import { googleDriveService } from "./google-drive.service";
import { extractKnowledgeText } from "./knowledge-extract";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
export function chunkKnowledgeText(text: string, kind: "text" | "spreadsheet" = "text", maxSize = CHUNK_SIZE): string[] {
  const normalized = String(text || "").trim();
  if (!normalized) return [];
  if (kind === "spreadsheet") {
    const [header, ...rows] = normalized.split(/\r?\n/);
    const chunks: string[] = []; let current = header;
    for (const row of rows) { if (`${current}\n${row}`.length > maxSize && current !== header) { chunks.push(current); current = header; } current += `\n${row}`; }
    return chunks.concat(current === header ? [] : [current]);
  }
  const chunks: string[] = []; let current = "";
  for (const paragraph of normalized.split(/\n\s*\n/)) {
    if (current && `${current}\n\n${paragraph}`.length > maxSize) { chunks.push(current); current = current.slice(-CHUNK_OVERLAP) + "\n\n" + paragraph; }
    else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  return current ? chunks.concat(current) : chunks;
}

export const knowledgeIngestService = {
  async syncCompanyDrive(companyCode: string) {
    const company: any = await CompanyModel.findOne({ code: companyCode.toUpperCase() }).lean();
    if (!company?.driveOAuth?.refreshToken || !company?.driveFolderId) throw new Error("Công ty chưa kết nối thư mục Google Drive.");
    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
    const files = await googleDriveService.listFolder(accessToken, company.driveFolderId);
    const results: Array<{ fileId: string; status: string; chunks?: number; reason?: string }> = [];
    for (const file of files) {
      try {
        if (Number(file.size || 0) > 20 * 1024 * 1024) { results.push({ fileId: file.id, status: "skipped", reason: "Tệp vượt 20MB" }); continue; }
        const extracted = await extractKnowledgeText(file, accessToken);
        const result = await this.replaceDocument({ companyCode, driveFileId: file.id, sourceTitle: file.name, sourceUrl: file.webViewLink, mimeType: file.mimeType, modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined, text: extracted.text, kind: extracted.kind });
        results.push({ fileId: file.id, status: result.skipped ? "skipped" : "indexed", chunks: result.chunks });
      } catch (error) { results.push({ fileId: file.id, status: "failed", reason: error instanceof Error ? error.message : "Không thể index tệp" }); }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return results;
  },
  async replaceDocument(input: { companyCode: string; driveFileId: string; sourceTitle: string; sourceUrl?: string; mimeType: string; modifiedTime?: Date; text: string; kind?: "text" | "spreadsheet" }) {
    if (Buffer.byteLength(input.text, "utf8") > 500_000) throw new Error("Nội dung tài liệu vượt giới hạn 500.000 ký tự.");
    const contentHash = createHash("sha256").update(input.text).digest("hex");
    const existing: any = await KnowledgeDocumentModel.findOne({ companyCode: input.companyCode, driveFileId: input.driveFileId });
    if (existing?.contentHash === contentHash) { await KnowledgeDocumentModel.updateOne({ _id: existing._id }, { $set: { modifiedTime: input.modifiedTime } }); return { skipped: true, documentId: String(existing._id) }; }
    const version = (existing?.version || 0) + 1;
    const document: any = await KnowledgeDocumentModel.findOneAndUpdate({ companyCode: input.companyCode, driveFileId: input.driveFileId }, { $set: { ...input, sourceType: "drive", contentHash, status: "active", version } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    await KnowledgeChunkModel.deleteMany({ documentId: document._id });
    const chunks = chunkKnowledgeText(input.text, input.kind);
    if (chunks.length) await KnowledgeChunkModel.insertMany(chunks.map((text, chunkIndex) => ({ companyCode: input.companyCode, documentId: document._id, chunkIndex, text, embedding: embeddingProvider.embed(text), visibility: document.visibility, allowedUserIds: document.allowedUserIds, allowedRoles: document.allowedRoles, version })));
    return { skipped: false, documentId: String(document._id), chunks: chunks.length };
  },
};
