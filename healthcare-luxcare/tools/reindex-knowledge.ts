import "dotenv/config";
import { KNOWLEDGE_EXTRACTION_VERSION } from "../shared/knowledge-extraction";
import mongoose from "mongoose";
import {
  AssistantKnowledgeDocumentModel,
  AssistantKnowledgeChunkModel,
  KnowledgeRevisionChunkModel,
} from "../server/model/assistant-knowledge.model";
import { enqueueKnowledge, ensureKnowledgeIndexes } from "../server/assistant/knowledge/knowledge-job.service";
import { readKnowledgeSource } from "../server/assistant/knowledge/knowledge-source.service";
import { KnowledgeJobModel } from "../server/model/knowledge-job.model";

const companyCode = process.argv
  .find((arg) => arg.startsWith("--company="))
  ?.slice(10)
  .trim()
  .toUpperCase();
const apply = process.argv.includes("--apply");
const extractionUpgrade = process.argv.includes("--extraction-upgrade");
if (!companyCode || !process.env.MONGODB_URI)
  throw new Error("Cần --company=CODE và MONGODB_URI. Mặc định chỉ xem trước; thêm --apply để tạo tác vụ.");
await mongoose.connect(process.env.MONGODB_URI, {
  user: process.env.MONGODB_USER,
  pass: process.env.MONGODB_PASSWORD,
  authSource: process.env.MONGODB_AUTH_SOURCE || "admin",
});
try {
  if (apply) await ensureKnowledgeIndexes();
  let count = 0;
  let missingSource = 0;
  for await (const document of AssistantKnowledgeDocumentModel.find({ companyCode, status: "active" }).cursor()) {
    if (document.isDeleted) continue;
    if (extractionUpgrade) {
      if (document.extractionQuality?.version >= KNOWLEDGE_EXTRACTION_VERSION) continue;
      if (!document.sourceFileId) {
        missingSource++;
        continue;
      }
    }
    count++;
    if (!apply) continue;
    const lastJob = await KnowledgeJobModel.findOne({ companyCode, documentId: document._id, status: "indexed" })
      .sort({ createdAt: -1 })
      .lean();
    const source = document.sourceFileId ? await readKnowledgeSource(companyCode, document.sourceFileId) : null;
    let text = "";
    if (!source) {
      const chunks = document.activeRevision
        ? await KnowledgeRevisionChunkModel.find({
            companyCode,
            documentId: document._id,
            revision: document.activeRevision,
          })
            .sort({ chunkIndex: 1 })
            .lean()
        : await AssistantKnowledgeChunkModel.find({ companyCode, documentId: document._id })
            .sort({ chunkIndex: 1 })
            .lean();
      for (const chunk of chunks) {
        const body = chunk.text.replace(/^Tài liệu: [^\n]*\n/, "");
        let overlap = Math.min(160, text.length, body.length);
        while (overlap > 0 && !text.endsWith(body.slice(0, overlap))) overlap--;
        text += body.slice(overlap);
      }
    }
    await enqueueKnowledge({
      companyCode,
      documentId: String(document._id),
      title: document.title,
      sourceType: document.sourceType as "manual" | "resource",
      resourceId: document.resourceId ? String(document.resourceId) : undefined,
      createdBy: document.createdBy,
      force: true,
      textInput: source ? Boolean(lastJob?.textInput) : true,
      file: {
        originalname: source?.filename || `${document.title}.txt`,
        mimetype: source?.mimeType || "text/plain",
        buffer: source?.buffer || Buffer.from(text),
      },
    });
  }
  console.log(
    JSON.stringify({
      companyCode,
      documents: count,
      missingSource,
      extractionUpgrade,
      mode: apply ? "queued" : "dry-run",
    }),
  );
} finally {
  await mongoose.disconnect();
}
