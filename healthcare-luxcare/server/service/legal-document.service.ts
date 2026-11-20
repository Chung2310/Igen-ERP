import { Types } from "mongoose";
import { getKnowledgeProgress } from "../assistant/knowledge/knowledge-progress.service";
import { LegalDocumentModel } from "../model/legal-document.model";
import { BlogPostModel } from "../model/blog-post.model";
import { CompanyModel } from "../model/company.model";
import { AssistantKnowledgeDocumentModel, KnowledgeRevisionChunkModel } from "../model/assistant-knowledge.model";
import { enqueueKnowledge } from "../assistant/knowledge/knowledge-job.service";
import { readKnowledgeSource } from "../assistant/knowledge/knowledge-source.service";
import type { KnowledgeUploadFile } from "../assistant/knowledge/knowledge-file-extractor";
import { legalMetadataSchema } from "../validation/legal-document.validation";
import { validateLegalAmendment } from "./legal-amendment.service";
import {
  canApproveLegal,
  canManageLegal,
  currentLegalDocuments,
  legalApplies,
  LEGAL_COMPANY,
} from "../assistant/knowledge/legal-policy";

type Actor = { id: string; role: string; companyCode?: string };
export async function createLegalDocument(user: Actor, postId: string, metadata: unknown, file: KnowledgeUploadFile) {
  if (!canManageLegal(user)) throw new Error("Bạn không có quyền quản lý pháp lý.");
  const parsed = legalMetadataSchema.validate(metadata);
  if (parsed.error) throw new Error(parsed.error.message);
  const input = parsed.value;
  const post = await BlogPostModel.findOne({ _id: postId, isDeleted: false });
  if (!post || (user.role === "blog_author" && String(post.authorId) !== user.id))
    throw new Error("Không tìm thấy bài đăng được phép cập nhật.");
  if (
    input.companyCodes.length &&
    (await CompanyModel.countDocuments({ code: { $in: input.companyCodes } })) !== input.companyCodes.length
  )
    throw new Error("Có mã doanh nghiệp không tồn tại.");
  await LegalDocumentModel.init();
  if (await LegalDocumentModel.exists({ number: input.number })) throw new Error("Số hiệu văn bản đã tồn tại.");
  const legalId = new Types.ObjectId();
  const queued = await enqueueKnowledge({
    companyCode: LEGAL_COMPANY,
    title: input.title,
    sourceType: "manual",
    documentType: "legal",
    // A unique identity per legal record prevents shared-file metadata from aliasing records.
    resourceId: String(legalId),
    createdBy: user.id,
    file,
  });
  return LegalDocumentModel.create({
    ...input,
    _id: legalId,
    postId,
    knowledgeDocumentId: queued.documentId,
    createdBy: user.id,
  });
}

export async function updateLegalDocument(user: Actor, id: string, metadata: unknown, updatedAt: string) {
  if (!canManageLegal(user)) throw new Error("Bạn không có quyền quản lý pháp lý.");
  const parsed = legalMetadataSchema.validate(metadata);
  if (parsed.error) throw new Error(parsed.error.message);
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) throw new Error("Thiếu phiên bản đang chỉnh sửa.");
  const input = parsed.value;
  if (
    input.companyCodes.length &&
    (await CompanyModel.countDocuments({ code: { $in: input.companyCodes } })) !== input.companyCodes.length
  )
    throw new Error("Có mã doanh nghiệp không tồn tại.");
  const changed = await LegalDocumentModel.findOneAndUpdate(
    {
      _id: id,
      status: "draft",
      updatedAt: new Date(updatedAt),
      ...(user.role === "blog_author" ? { createdBy: user.id } : {}),
    },
    {
      $set: input,
      $unset: {
        ...(!input.replaces ? { replaces: 1 } : {}),
        ...(!input.amends ? { amends: 1 } : {}),
        ...(!input.effectiveTo ? { effectiveTo: 1 } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!changed) throw new Error("Văn bản đã thay đổi hoặc bạn không được phép sửa. Vui lòng tải lại.");
  return changed;
}

export async function approveLegalDocument(user: Actor, id: string, reviewedUpdatedAt: string) {
  if (!canApproveLegal(user)) throw new Error("Chỉ biên tập viên hoặc superadmin được duyệt pháp lý.");
  await LegalDocumentModel.init();
  const document = await LegalDocumentModel.findById(id).lean();
  if (!document || document.status !== "draft") throw new Error("Văn bản không còn ở trạng thái chờ duyệt.");
  if (!reviewedUpdatedAt || document.updatedAt.toISOString() !== reviewedUpdatedAt)
    throw new Error("Nội dung duyệt đã thay đổi. Vui lòng mở lại và kiểm tra.");
  const knowledge = await AssistantKnowledgeDocumentModel.findOne({
    _id: document.knowledgeDocumentId,
    companyCode: LEGAL_COMPANY,
    indexingStatus: "indexed",
    status: "active",
  }).lean();
  if (!knowledge?.activeRevision || !knowledge.sourceFileId || !knowledge.chunksCount)
    throw new Error("File chưa xử lý thành công. Chỉ duyệt sau khi kiểm tra nội dung đã trích xuất.");
  if (document.structureRevision && document.structureSourceRevision !== knowledge.activeRevision)
    throw new Error("File đã được xử lý lại; cần mở và lưu cấu trúc điều/khoản theo phiên bản mới.");
  const sectionClaims = await validateLegalAmendment(document);
  if (document.replaces) {
    const old = await LegalDocumentModel.findById(document.replaces).lean();
    if (old?.amends) throw new Error("Thay thế toàn văn phải trỏ đến văn bản gốc, không phải văn bản sửa đổi.");
    if (!old?.approvedAt || old.effectiveFrom >= document.effectiveFrom || String(old._id) === id)
      throw new Error("Văn bản bị thay thế phải đã được duyệt và có ngày hiệu lực sớm hơn.");
    if ([...old.companyCodes].sort().join() !== [...document.companyCodes].sort().join())
      throw new Error("Thay thế toàn văn cần cùng phạm vi doanh nghiệp.");
  }
  // One atomic write publishes the immutable revision and the replacement edge together.
  const approved = await LegalDocumentModel.findOneAndUpdate(
    { _id: id, status: "draft", updatedAt: document.updatedAt },
    {
      $set: {
        status: "approved",
        approvedBy: user.id,
        approvedAt: new Date(),
        approvedRevision: knowledge.activeRevision,
        approvedContentHash: knowledge.contentHash,
        sourceFileId: knowledge.sourceFileId,
        ...(document.replaces ? { replacementClaim: document.replaces } : {}),
        ...(sectionClaims.length ? { sectionClaims } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!approved) throw new Error("Trạng thái văn bản đã thay đổi. Vui lòng tải lại.");
  return approved;
}

export async function withdrawLegalDocument(user: Actor, id: string, reason: string) {
  if (!canApproveLegal(user)) throw new Error("Bạn không có quyền thu hồi pháp lý.");
  if (typeof reason !== "string" || !reason.trim() || reason.length > 2000)
    throw new Error("Nhập lý do thu hồi (tối đa 2.000 ký tự).");
  const result = await LegalDocumentModel.findOneAndUpdate(
    { _id: id, status: { $in: ["draft", "approved"] } },
    { $set: { status: "withdrawn", withdrawnBy: user.id, withdrawnAt: new Date(), withdrawalReason: reason.trim() } },
    { returnDocument: "after" },
  );
  if (!result) throw new Error("Không tìm thấy văn bản có thể thu hồi.");
  return result;
}

export async function visibleLegalDocument(user: Actor, id: string) {
  const document = await LegalDocumentModel.findById(id).lean();
  if (!document || (!canManageLegal(user) && (!document.approvedAt || !legalApplies(document, user.companyCode || ""))))
    throw new Error("Không tìm thấy văn bản được phép đọc.");
  return document;
}

export async function listLegalDocuments(user: Actor) {
  const documents = await LegalDocumentModel.find(
    canManageLegal(user)
      ? {}
      : {
          approvedAt: { $exists: true },
          $or: [{ companyCodes: { $size: 0 } }, { companyCodes: user.companyCode || "__none__" }],
        },
  )
    .sort({ createdAt: -1 })
    .lean();
  const current = new Set(currentLegalDocuments(documents, user.companyCode || "SYSTEM").map((d) => String(d._id)));
  const knowledge = await AssistantKnowledgeDocumentModel.find({
    companyCode: LEGAL_COMPANY,
    _id: { $in: documents.map((d) => d.knowledgeDocumentId) },
  })
    .select("indexingStatus indexingError chunksCount")
    .lean();
  const index = new Map(knowledge.map((d) => [String(d._id), d]));
  const progress = await getKnowledgeProgress(
    LEGAL_COMPANY,
    documents.map((d) => d.knowledgeDocumentId),
  );
  return {
    canManage: canManageLegal(user),
    canApprove: canApproveLegal(user),
    documents: documents.map((d) => ({
      ...d,
      current: current.has(String(d._id)),
      indexingStatus:
        progress.get(String(d.knowledgeDocumentId))?.status || index.get(String(d.knowledgeDocumentId))?.indexingStatus,
      indexingError: progress.has(String(d.knowledgeDocumentId))
        ? progress.get(String(d.knowledgeDocumentId))?.error || ""
        : index.get(String(d.knowledgeDocumentId))?.indexingError,
      indexingProgress: progress.get(String(d.knowledgeDocumentId))?.progress,
    })),
  };
}

export async function legalDocumentSource(user: Actor, id: string) {
  const document = await visibleLegalDocument(user, id);
  const knowledge = await AssistantKnowledgeDocumentModel.findOne({
    _id: document.knowledgeDocumentId,
    companyCode: LEGAL_COMPANY,
  }).lean();
  const sourceId = document.sourceFileId || knowledge?.sourceFileId;
  if (!sourceId) throw new Error("File chưa được xử lý xong.");
  return readKnowledgeSource(LEGAL_COMPANY, sourceId);
}

export async function legalDocumentPreview(user: Actor, id: string) {
  const document = await visibleLegalDocument(user, id);
  const knowledge = await AssistantKnowledgeDocumentModel.findOne({
    _id: document.knowledgeDocumentId,
    companyCode: LEGAL_COMPANY,
  }).lean();
  const revision = document.approvedRevision || knowledge?.activeRevision;
  const chunks = revision
    ? await KnowledgeRevisionChunkModel.find({
        companyCode: LEGAL_COMPANY,
        documentId: document.knowledgeDocumentId,
        revision,
      })
        .select("text chunkIndex")
        .sort({ chunkIndex: 1 })
        .lean()
    : [];
  return { document, chunks };
}

export async function retryLegalDocument(user: Actor, id: string) {
  if (!canManageLegal(user)) throw new Error("Bạn không có quyền quản lý pháp lý.");
  const document = await visibleLegalDocument(user, id);
  if (user.role === "blog_author" && document.createdBy !== user.id)
    throw new Error("Bạn chỉ được xử lý lại file của mình.");
  if (document.status !== "draft") throw new Error("Chỉ xử lý lại bản chưa duyệt.");
  // Retry the durable original job, including failures before extraction saved sourceFileId on the document.
  const { KnowledgeJobModel } = await import("../model/knowledge-job.model");
  const job = await KnowledgeJobModel.findOne({ companyCode: LEGAL_COMPANY, documentId: document.knowledgeDocumentId })
    .sort({ createdAt: -1 })
    .lean();
  if (!job) throw new Error("Không tìm thấy file nguồn.");
  const source = await readKnowledgeSource(LEGAL_COMPANY, job.sourceFileId);
  return enqueueKnowledge({
    companyCode: LEGAL_COMPANY,
    documentId: String(document.knowledgeDocumentId),
    title: document.title,
    sourceType: "manual",
    createdBy: user.id,
    force: true,
    file: { originalname: source.filename, mimetype: source.mimeType, buffer: source.buffer },
  });
}
