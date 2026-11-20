import type { Response } from "express";
import {
  AssistantKnowledgeChunkModel,
  AssistantKnowledgeDocumentModel,
  KnowledgeRevisionChunkModel,
} from "../model/assistant-knowledge.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { KnowledgeJobModel } from "../model/knowledge-job.model";
import type { AuthenticatedRequest } from "../middleware/auth";
import { searchCombinedKnowledge as searchKnowledge } from "../assistant/knowledge/legal-retrieval.service";
import { sanitizeKnowledgeFilename } from "../assistant/knowledge/knowledge-file-extractor";
import { enqueueKnowledge } from "../assistant/knowledge/knowledge-job.service";
import {
  filterResourceDocuments,
  knowledgeAccessFilter,
  resolveKnowledgeContext,
} from "../assistant/knowledge/knowledge-access";
import { canAccessResourceItem } from "../service/resource.service";
import { readKnowledgeSource } from "../assistant/knowledge/knowledge-source.service";
import { BranchModel } from "../model/branch.model";
import { DepartmentModel } from "../model/department.model";
import { suggestSupersededDocument } from "../assistant/knowledge/medical-audit.service";
import { getKnowledgeProgress } from "../assistant/knowledge/knowledge-progress.service";

function tenant(req: AuthenticatedRequest): string {
  const companyCode = String(req.user?.companyCode || "")
    .trim()
    .toUpperCase();
  if (!companyCode) throw new Error("Tài khoản chưa được gắn với doanh nghiệp.");
  return companyCode;
}
function metadata(body: any = {}) {
  return Object.fromEntries(
    [
      "documentType",
      "category",
      "visibility",
      "branchIds",
      "departmentIds",
      "replaces",
      "effectiveFrom",
      "effectiveTo",
      "auditStatus",
      "auditFlags",
    ]
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}
async function validScope(companyCode: string, body: any = {}) {
  const branches: string[] = body.branchIds || [];
  const departments: string[] = body.departmentIds || [];
  if ([...branches, ...departments].some((id) => !/^[a-f0-9]{24}$/i.test(id))) return false;
  if (
    branches.length &&
    (await BranchModel.countDocuments({ companyCode, _id: { $in: branches } })) !== branches.length
  )
    return false;
  if (
    departments.length &&
    (await DepartmentModel.countDocuments({ companyCode, _id: { $in: departments } })) !== departments.length
  )
    return false;
  return true;
}
async function visibleDocument(req: AuthenticatedRequest) {
  const context = await resolveKnowledgeContext(req.user!);
  const documents = await AssistantKnowledgeDocumentModel.find({
    ...knowledgeAccessFilter(context),
    _id: req.params.id,
  }).lean();
  return (await filterResourceDocuments(documents, context))[0];
}
export const assistantKnowledgeController = {
  async scopes(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const [branches, departments] = await Promise.all([
      BranchModel.find({ companyCode }).select("name").lean(),
      DepartmentModel.find({ companyCode }).select("name").lean(),
    ]);
    return res.json({ branches, departments });
  },
  async list(req: AuthenticatedRequest, res: Response) {
    const context = await resolveKnowledgeContext(req.user!);
    const documents = await filterResourceDocuments(
      await AssistantKnowledgeDocumentModel.find({
        ...knowledgeAccessFilter(context),
        isDeleted: { $ne: true },
      })
        .select("-processingToken -leaseUntil -identityKey -workbook")
        .sort({ updatedAt: -1 })
        .lean(),
      context,
    );
    const progress = await getKnowledgeProgress(
      context.companyCode,
      documents.map((document) => document._id),
    );
    return res.json({
      success: true,
      documents: documents.map((document) => {
        const job = progress.get(String(document._id));
        return {
          ...document,
          indexingProgress: job?.progress,
          ...(job ? { indexingStatus: job.status, indexingError: job.error || "" } : {}),
        };
      }),
    });
  },
  async create(req: AuthenticatedRequest, res: Response) {
    if (!(await validScope(tenant(req), req.body)))
      return res.status(400).json({ success: false, message: "Chi nhánh hoặc phòng ban không thuộc doanh nghiệp." });
    const result = await enqueueKnowledge({
      context: await resolveKnowledgeContext(req.user!),
      companyCode: tenant(req),
      title: req.body.title,
      sourceType: "manual",
      createdBy: req.user!.id,
      ...metadata(req.body),
      textInput: true,
      file: { originalname: `${req.body.title}.txt`, mimetype: "text/plain", buffer: Buffer.from(req.body.text) },
    });
    return res.status(202).json({ success: true, ...result });
  },
  async uploadFiles(req: AuthenticatedRequest, res: Response) {
    if (!(await validScope(tenant(req), req.body)))
      return res.status(400).json({ success: false, message: "Chi nhánh hoặc phòng ban không thuộc doanh nghiệp." });
    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    if (!files.length) return res.status(400).json({ success: false, message: "Vui lòng chọn ít nhất một tệp." });
    const results = [];
    for (const file of files) {
      const filename = sanitizeKnowledgeFilename(file.originalname);
      try {
        results.push(
          await enqueueKnowledge({
            context: await resolveKnowledgeContext(req.user!),
            companyCode: tenant(req),
            title: filename,
            sourceType: "manual",
            createdBy: req.user!.id,
            ...metadata(req.body),
            file,
          }),
        );
      } catch (error) {
        results.push({
          filename,
          status: "rejected",
          message: error instanceof Error ? error.message : "Không thể tiếp nhận tệp.",
        });
      }
    }
    return res.status(202).json({ success: true, results });
  },
  async syncResource(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    if (!(await validScope(companyCode, req.body)))
      return res.status(400).json({ success: false, message: "Chi nhánh hoặc phòng ban không thuộc doanh nghiệp." });
    const resource = await ResourceItemModel.findOne({
      _id: req.params.resourceId,
      companyCode,
      type: "file",
      isDeleted: { $ne: true },
    }).lean();
    if (!resource || !(await canAccessResourceItem(companyCode, resource, req.user!.id, req.user!.role)))
      return res.status(404).json({ success: false, message: "Không tìm thấy tài nguyên trong phạm vi được phép." });
    const result = await enqueueKnowledge({
      context: await resolveKnowledgeContext(req.user!),
      companyCode,
      title: resource.name,
      sourceType: "resource",
      resourceId: String(resource._id),
      createdBy: req.user!.id,
      ...metadata(req.body),
      textInput: true,
      file: { originalname: `${resource.name}.txt`, mimetype: "text/plain", buffer: Buffer.from(req.body.text) },
    });
    await ResourceItemModel.updateOne(
      { _id: resource._id, companyCode },
      { $set: { assistantKnowledgeEnabled: true } },
    );
    return res.status(202).json({ success: true, ...result });
  },
  async updateMetadata(req: AuthenticatedRequest, res: Response) {
    const current = await visibleDocument(req);
    if (!current) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu." });
    const changes = metadata(req.body);
    if (!(await validScope(tenant(req), changes)))
      return res.status(400).json({ success: false, message: "Chi nhánh hoặc phòng ban không thuộc doanh nghiệp." });
    const next = { ...current, ...changes };
    if (next.visibility === "restricted" && !next.branchIds?.length && !next.departmentIds?.length)
      return res.status(400).json({ success: false, message: "Phạm vi hạn chế cần chi nhánh hoặc phòng ban." });
    const document = await AssistantKnowledgeDocumentModel.findOneAndUpdate(
      { _id: current._id, companyCode: tenant(req) },
      { $set: changes },
      { returnDocument: "after", runValidators: true },
    ).select("-processingToken -leaseUntil -identityKey -workbook");
    return res.json({ success: true, document });
  },
  async detail(req: AuthenticatedRequest, res: Response) {
    const document = await visibleDocument(req);
    if (!document) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu." });
    if (req.query.revision && req.query.revision !== (document.activeRevision || "legacy"))
      return res.status(409).json({
        success: false,
        message: "Tài liệu đã cập nhật sau câu trả lời này. Vui lòng tra cứu lại để xem nguồn mới.",
      });
    const filter = { companyCode: tenant(req), documentId: document._id };
    const chunks = document.activeRevision
      ? await KnowledgeRevisionChunkModel.find({ ...filter, revision: document.activeRevision })
          .select("text chunkIndex")
          .sort({ chunkIndex: 1 })
          .lean()
      : await AssistantKnowledgeChunkModel.find(filter).select("text chunkIndex").sort({ chunkIndex: 1 }).lean();
    const doc = document as any;
    return res.json({
      success: true,
      _id: String(doc._id),
      documentId: String(doc._id),
      title: doc.title,
      sourceFileId: doc.sourceFileId ? String(doc.sourceFileId) : undefined,
      sourceType: doc.sourceType,
      documentType: doc.documentType,
      category: doc.category,
      medicalCategory: doc.medicalCategory,
      medicalRiskLevel: doc.medicalRiskLevel,
      requiresSpotCheck: doc.requiresSpotCheck,
      isSpotChecked: doc.isSpotChecked,
      status: doc.status,
      extractionQuality: doc.extractionQuality,
      isScanned: doc.isScanned,
      effectiveFrom: doc.effectiveFrom,
      effectiveTo: doc.effectiveTo,
      replacesDocumentId: doc.replacesDocumentId,
      supersededByDocumentId: doc.supersededByDocumentId,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      chunks,
    });
  },
  async source(req: AuthenticatedRequest, res: Response) {
    const document = await visibleDocument(req);
    if (!document?.sourceFileId)
      return res.status(404).json({ success: false, message: "Tài liệu chưa có tệp nguồn lưu trữ." });
    const source = await readKnowledgeSource(tenant(req), document.sourceFileId);
    let mimeType = source.mimeType;
    const filename = source.filename || document.title || "document";
    const lower = filename.toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream") {
      if (lower.endsWith(".pdf")) mimeType = "application/pdf";
      else if (lower.endsWith(".png")) mimeType = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mimeType = "image/jpeg";
      else if (lower.endsWith(".webp")) mimeType = "image/webp";
      else if (lower.endsWith(".txt")) mimeType = "text/plain; charset=utf-8";
      else if (lower.endsWith(".md")) mimeType = "text/markdown; charset=utf-8";
      else if (lower.endsWith(".json")) mimeType = "application/json";
      else if (lower.endsWith(".csv")) mimeType = "text/csv; charset=utf-8";
      else if (lower.endsWith(".docx"))
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (lower.endsWith(".xlsx")) mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else mimeType = "application/octet-stream";
    }
    const isInline = req.query.inline === "true";
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    return res.send(source.buffer);
  },
  async retry(req: AuthenticatedRequest, res: Response) {
    const document = await visibleDocument(req);
    if (!document) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu." });
    const lastJob = await KnowledgeJobModel.findOne({ companyCode: tenant(req), documentId: document._id })
      .sort({ createdAt: -1 })
      .lean();
    const sourceId = lastJob?.sourceFileId || document.sourceFileId;
    if (!sourceId)
      return res.status(400).json({ success: false, message: "Vui lòng tải lại tệp nguồn để lập chỉ mục." });
    const source = await readKnowledgeSource(tenant(req), sourceId);
    const result = await enqueueKnowledge({
      context: await resolveKnowledgeContext(req.user!),
      companyCode: tenant(req),
      title: document.title,
      documentId: String(document._id),
      sourceType: document.sourceType as "manual" | "resource",
      resourceId: document.resourceId ? String(document.resourceId) : undefined,
      createdBy: req.user!.id,
      force: true,
      textInput: lastJob?.textInput || false,
      file: { originalname: source.filename, mimetype: source.mimeType, buffer: source.buffer },
    });
    return res.status(202).json({ success: true, ...result });
  },
  async remove(req: AuthenticatedRequest, res: Response) {
    const document = await visibleDocument(req);
    if (!document) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu." });
    const companyCode = tenant(req);
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: document._id, companyCode },
      {
        $set: {
          isDeleted: true,
          status: "withdrawn",
          deletedAt: new Date(),
          deletedBy: req.user!.id,
          deletionReason: req.body?.reason || "Người dùng gỡ khỏi kho tri thức",
        },
      },
    );
    await KnowledgeJobModel.updateMany(
      { documentId: document._id, companyCode, active: true },
      { $set: { active: false, status: "failed", error: "Tài liệu đã bị gỡ." } },
    );
    await AssistantKnowledgeChunkModel.deleteMany({ companyCode, documentId: document._id });
    await KnowledgeRevisionChunkModel.deleteMany({ companyCode, documentId: document._id });
    if (document.resourceId)
      await ResourceItemModel.updateOne(
        { _id: document.resourceId, companyCode },
        { $set: { assistantKnowledgeEnabled: false } },
      );
    return res.json({ success: true, message: "Tài liệu đã được gỡ khỏi kho tri thức." });
  },
  async suggestReplacement(req: AuthenticatedRequest, res: Response) {
    const context = await resolveKnowledgeContext(req.user!);
    const documents = await filterResourceDocuments(
      await AssistantKnowledgeDocumentModel.find({
        ...knowledgeAccessFilter(context),
        isDeleted: { $ne: true },
        status: "active",
      })
        .select("title _id")
        .lean(),
      context,
    );
    const existing = documents.map((d: any) => ({
      id: String(d._id),
      title: d.title,
    }));
    const suggestion = suggestSupersededDocument(req.body.title || "", req.body.number, existing);
    return res.json({ success: true, suggestion, existing });
  },
  async verifySpotCheck(req: AuthenticatedRequest, res: Response) {
    const document = await visibleDocument(req);
    if (!document) return res.status(404).json({ success: false, message: "Không tìm thấy tài liệu." });
    const companyCode = tenant(req);
    if (req.body.contentHash !== document.contentHash || document.indexingStatus !== "indexed")
      return res.status(409).json({ success: false, message: "Tài liệu đã thay đổi hoặc đang xử lý. Vui lòng mở lại Spot-check." });
    const flags = document.auditFlags || [];
    const ids: string[] = req.body.flagIds;
    if (ids.some((id) => !flags.some((flag: any) => flag.id === id)))
      return res.status(400).json({ success: false, message: "Điểm kiểm tra không còn tồn tại." });
    const auditFlags = flags.map((flag: any) => ids.includes(flag.id) && flag.reviewStatus !== "confirmed"
      ? { ...flag, reviewStatus: "confirmed", reviewedBy: req.user!.id, reviewedAt: new Date(), reviewNote: req.body.note || "" }
      : flag);
    const auditStatus = auditFlags.every((flag: any) => flag.reviewStatus === "confirmed") ? "verified" : document.auditStatus;
    const result = await AssistantKnowledgeDocumentModel.updateOne(
      { _id: document._id, companyCode, contentHash: document.contentHash, updatedAt: document.updatedAt, indexingStatus: "indexed" },
      { $set: { auditFlags, auditStatus } },
    );
    if (!result.matchedCount)
      return res.status(409).json({ success: false, message: "Tài liệu vừa được cập nhật. Vui lòng mở lại Spot-check." });
    return res.json({ success: true, auditFlags, auditStatus, message: "Đã xác nhận nội dung đúng và giữ nguyên tài liệu." });
  },
  async testSearch(req: AuthenticatedRequest, res: Response) {
    const evidence = await searchKnowledge({
      context: await resolveKnowledgeContext(req.user!),
      query: req.body.query,
      topK: req.body.topK,
      category: req.body.category,
      documentType: req.body.documentType,
    });
    return res.json({ success: true, evidence });
  },
};
