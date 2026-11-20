import { logger } from "../../config/logger";
import crypto from "node:crypto";
import { AiSharingError, withAiSharingPermission } from "../../service/ai-sharing.service";
import { aiSharingContext } from "../../service/ai-sharing-context";
import { KNOWLEDGE_EXTRACTION_VERSION } from "../../../shared/knowledge-extraction";
import type { ReportKnowledgeProgress } from "../../../shared/knowledge-progress";
import { AssistantKnowledgeDocumentModel, KnowledgeRevisionChunkModel } from "../../model/assistant-knowledge.model";
import { KnowledgeJobModel } from "../../model/knowledge-job.model";
import {
  extractKnowledgeFile,
  sanitizeKnowledgeFilename,
  validateKnowledgeFile,
  type KnowledgeUploadFile,
} from "./knowledge-file-extractor";
import { readKnowledgeSource, saveKnowledgeSource, knowledgeSourceBucket } from "./knowledge-source.service";
import { upsertKnowledgeDocument, type KnowledgeInput } from "./knowledge-retrieval.service";
import type { AssistantAccessContext } from "../assistant.types";
import { canReadKnowledgeDocument, filterResourceDocuments, knowledgeAccessFilter } from "./knowledge-access";
import { auditMedicalText } from "./medical-audit.service";

let ready: Promise<unknown> | undefined;
export function ensureKnowledgeIndexes() {
  ready ||= Promise.all([
    AssistantKnowledgeDocumentModel.init(),
    KnowledgeRevisionChunkModel.init(),
    KnowledgeJobModel.init(),
  ]).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function enqueueKnowledge(
  input: Omit<KnowledgeInput, "text"> & {
    file: KnowledgeUploadFile;
    textInput?: boolean;
    context?: AssistantAccessContext;
  },
) {
  await ensureKnowledgeIndexes();
  if (!input.textInput) validateKnowledgeFile(input.file);
  const filename = sanitizeKnowledgeFilename(input.file.originalname);
  const hash = crypto.createHash("sha256").update(input.file.buffer).digest("hex");
  const identityKey = input.resourceId ? `resource:${input.resourceId}` : `source:${hash}`;
  const companyCode = input.companyCode.trim().toUpperCase();
  if (
    input.context &&
    !input.documentId &&
    !canReadKnowledgeDocument(
      {
        companyCode,
        visibility: input.visibility || "company",
        branchIds: input.branchIds,
        departmentIds: input.departmentIds,
      },
      input.context,
    )
  )
    throw new Error("Không thể tạo tài liệu ngoài phạm vi được phép đọc.");
  const selector = input.documentId ? { companyCode, _id: input.documentId } : { companyCode, identityKey };
  let document = await AssistantKnowledgeDocumentModel.findOne(selector);
  if (!document && input.documentId) throw new Error("Tài liệu đã bị gỡ.");
  if (!document) {
    try {
      document = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
        selector,
        {
          $setOnInsert: {
            companyCode,
            identityKey,
            title: input.title,
            contentHash: hash,
            sourceType: input.sourceType,
            resourceId: input.resourceId,
            createdBy: input.createdBy,
            status: "failed",
            indexingStatus: "queued",
            documentType: input.documentType || "general",
            category: input.category || "",
            visibility: input.visibility || "company",
            branchIds: input.branchIds || [],
            departmentIds: input.departmentIds || [],
            replaces: (input as any).replaces,
            effectiveFrom: (input as any).effectiveFrom ? new Date((input as any).effectiveFrom) : new Date(),
            effectiveTo: (input as any).effectiveTo ? new Date((input as any).effectiveTo) : undefined,
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      document = await AssistantKnowledgeDocumentModel.findOne(selector);
    }
  }
  if (!document) throw new Error("Không thể tạo tài liệu.");
  if (input.context) {
    const readable = await AssistantKnowledgeDocumentModel.find({
      ...knowledgeAccessFilter(input.context),
      _id: document._id,
    }).lean();
    if (!(await filterResourceDocuments(readable, input.context)).length)
      throw new Error("Không thể tiếp nhận tài liệu trong phạm vi này.");
  }
  const running = await KnowledgeJobModel.findOne({ companyCode, documentId: document._id, active: true }).lean();
  if (running)
    return { filename, status: "queued" as const, documentId: String(document._id), jobId: String(running._id) };
  if (!input.force && !input.resourceId && document.status === "active" && document.activeRevision)
    return {
      filename,
      status: "duplicate" as const,
      documentId: String(document._id),
      chunksCount: document.chunksCount,
    };
  let sourceFileId;
  try {
    sourceFileId = await saveKnowledgeSource(companyCode, filename, input.file.buffer, input.file.mimetype);
  } catch (error) {
    await AssistantKnowledgeDocumentModel.updateOne(
      { companyCode, _id: document._id, processingToken: { $exists: false } },
      { $set: { indexingStatus: "failed", indexingError: "Không thể lưu tệp nguồn. Vui lòng tải lại." } },
    );
    throw error;
  }
  try {
    const job = await KnowledgeJobModel.create({
      companyCode,
      documentId: document._id,
      sourceFileId,
      filename,
      mimeType: input.file.mimetype,
      createdBy: input.createdBy,
      textInput: Boolean(input.textInput),
      force: input.force,
    });
    await AssistantKnowledgeDocumentModel.updateOne(
      { companyCode, _id: document._id },
      { $set: { indexingStatus: "queued", indexingError: "" } },
    );
    return { filename, status: "queued" as const, documentId: String(document._id), jobId: String(job._id) };
  } catch (error: any) {
    // A concurrent enqueue can win the unique active-job slot.
    if (error.code === 11000) {
      await knowledgeSourceBucket().delete(sourceFileId);
      const job = await KnowledgeJobModel.findOne({ companyCode, documentId: document._id, active: true }).lean();
      if (job) return { filename, status: "queued" as const, documentId: String(document._id), jobId: String(job._id) };
    }
    await AssistantKnowledgeDocumentModel.updateOne(
      { companyCode, _id: document._id, processingToken: { $exists: false } },
      { $set: { indexingStatus: "failed", indexingError: "Không thể tạo tác vụ. Vui lòng tải lại tài liệu." } },
    );
    throw error;
  }
}

export async function processKnowledgeJob(): Promise<boolean> {
  const now = new Date();
  const token = crypto.randomUUID();
  const job = await KnowledgeJobModel.findOneAndUpdate(
    {
      active: true,
      availableAt: { $lte: now },
      $or: [{ status: "queued" }, { status: "processing", leaseUntil: { $lte: now } }],
    },
    {
      $set: {
        status: "processing",
        token,
        leaseUntil: new Date(Date.now() + 120_000),
        progress: { stage: "reading", updatedAt: new Date() },
      },
      $unset: { error: 1 },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after", sort: { availableAt: 1 } },
  );
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void KnowledgeJobModel.updateOne(
      { _id: job._id, token, active: true },
      { $set: { leaseUntil: new Date(Date.now() + 120_000) } },
    ).catch(() => undefined);
  }, 30_000);
  heartbeat.unref();
  const onProgress: ReportKnowledgeProgress = async (progress) => {
    const result = await KnowledgeJobModel.updateOne(
      { _id: job._id, token, active: true, leaseUntil: { $gt: new Date() } },
      { $set: { progress: { ...progress, updatedAt: new Date() } } },
    );
    if (!(result.matchedCount ?? result.modifiedCount)) throw new Error("Phiên xử lý tài liệu đã hết hạn.");
  };
  try {
    await withAiSharingPermission(job.createdBy, "company", async () => {
    if (aiSharingContext.getStore()?.companyCode !== job.companyCode)
      throw new AiSharingError("Tài khoản đã đổi doanh nghiệp. Cần xác nhận chia sẻ tài liệu lại.", 403, "AI_CONSENT_REQUIRED");
    if (job.attempts > 3) throw new Error("Đã vượt số lần xử lý cho phép.");
    const document = await AssistantKnowledgeDocumentModel.findOne({
      _id: job.documentId,
      companyCode: job.companyCode,
    }).lean();
    if (!document) throw new Error("Tài liệu đã bị gỡ.");
    const source = await readKnowledgeSource(job.companyCode, job.sourceFileId);
    const extracted = job.textInput
      ? {
          title: document.title,
          text: source.buffer.toString("utf8"),
          quality: { version: KNOWLEDGE_EXTRACTION_VERSION, status: "complete" as const, warnings: [] as string[] },
          workbook: undefined,
        }
      : await extractKnowledgeFile(
          { originalname: source.filename, mimetype: source.mimeType, buffer: source.buffer },
          onProgress,
        );
    const audit = auditMedicalText(extracted.text);
    const result = await upsertKnowledgeDocument({
      onProgress,
      companyCode: job.companyCode,
      documentId: String(document._id),
      title: extracted.title,
      text: extracted.text,
      extractionQuality: extracted.quality,
      workbook: extracted.workbook,
      sourceType: document.sourceType as "manual" | "resource",
      resourceId: document.resourceId ? String(document.resourceId) : undefined,
      createdBy: job.createdBy,
      force: job.force,
      sourceFileId: String(job.sourceFileId),
      replaces: (document as any).replaces ? String((document as any).replaces) : undefined,
      effectiveFrom: (document as any).effectiveFrom,
      effectiveTo: (document as any).effectiveTo,
      auditFlags: audit.flags,
      auditStatus: audit.requiresSpotCheck ? "flagged" : "clean",
    });
    await KnowledgeJobModel.updateOne(
      { _id: job._id, token, active: true },
      {
        $set: {
          status: "indexed",
          active: false,
          chunksCount: result.chunksCount,
          progress: { stage: "complete", updatedAt: new Date() },
        },
        $unset: { leaseUntil: 1, token: 1, error: 1 },
      },
    );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể xử lý tài liệu.";
    const retry = job.attempts < 3 && !(error instanceof AiSharingError && error.statusCode === 403);
    const changed = await KnowledgeJobModel.updateOne(
      { _id: job._id, token, active: true },
      {
        $set: {
          status: retry ? "queued" : "failed",
          active: retry,
          error: message,
          availableAt: new Date(Date.now() + job.attempts * 15_000),
        },
        $unset: { leaseUntil: 1, token: 1 },
      },
    );
    if (changed.modifiedCount)
      await AssistantKnowledgeDocumentModel.updateOne(
        { _id: job.documentId, companyCode: job.companyCode, processingToken: { $exists: false } },
        { $set: { indexingStatus: retry ? "queued" : "failed", indexingError: message } },
      );
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export function startKnowledgeWorker() {
  if (process.env.KNOWLEDGE_WORKER_ENABLED === "false") return () => undefined;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await ensureKnowledgeIndexes();
      const processed = await processKnowledgeJob();
      if (!processed) {
        const { processKnowledgeLegalScan } = await import("./knowledge-legal-scan.service");
        await processKnowledgeLegalScan();
      }
    } catch (error) {
      logger.error("[KnowledgeWorker]", error);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 2000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
