import Joi from "joi";
import { Types } from "mongoose";
import { AssistantKnowledgeDocumentModel } from "../model/assistant-knowledge.model";
import { KnowledgeLegalReviewModel } from "../model/knowledge-legal-review.model";
import type { AssistantAccessContext } from "../assistant/assistant.types";
import {
  filterResourceDocuments,
  hasKnowledgePermission,
  knowledgeAccessFilter,
} from "../assistant/knowledge/knowledge-access";
import {
  expandedReviewChunks,
  knowledgeReviewRevision,
  knowledgeReviewStatus,
  legalDependencySnapshot,
} from "../assistant/knowledge/knowledge-legal-review-policy";
import {
  loadLegalReviewCatalog,
  reviewDocumentChunks,
  scanKnowledgeLegalDocument,
} from "../assistant/knowledge/knowledge-legal-scan.service";
import { legalApplies } from "../assistant/knowledge/legal-policy";

function requireManage(context: AssistantAccessContext) {
  if (!hasKnowledgePermission(context, "manage")) throw new Error("Bạn không có quyền quản lý kho tri thức.");
}
export async function visibleReviewDocuments(context: AssistantAccessContext) {
  return filterResourceDocuments(
    await AssistantKnowledgeDocumentModel.find(knowledgeAccessFilter(context)).lean(),
    context,
  );
}
async function visibleDocument(context: AssistantAccessContext, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Mã tài liệu không hợp lệ.");
  const documents = await filterResourceDocuments(
    await AssistantKnowledgeDocumentModel.find({ ...knowledgeAccessFilter(context), _id: id }).lean(),
    context,
  );
  if (!documents.length) throw new Error("Không tìm thấy tài liệu trong phạm vi được phép.");
  return documents[0];
}
export async function listKnowledgeLegalReviews(context: AssistantAccessContext) {
  const documents = await visibleReviewDocuments(context);
  const catalog = await loadLegalReviewCatalog();
  const links = await KnowledgeLegalReviewModel.find({
    companyCode: context.companyCode,
    documentId: { $in: documents.map((d) => d._id) },
  })
    .sort({ updatedAt: -1 })
    .lean();
  const byId = new Map(documents.map((d) => [String(d._id), d]));
  return {
    canManage: hasKnowledgePermission(context, "manage"),
    documents: documents.map((d) => ({ id: String(d._id), title: d.title })),
    laws: catalog.laws
      .filter((law) => legalApplies(law, context.companyCode))
      .map((law) => ({ id: String(law._id), number: law.number, title: law.title })),
    reviews: links.map((link) => {
      const document = byId.get(String(link.documentId))!;
      const snapshot = legalDependencySnapshot(
        link.legalDocumentId,
        link.sectionKeys || [],
        catalog.laws,
        context.companyCode,
      );
      const allSections = legalDependencySnapshot(link.legalDocumentId, [], catalog.laws, context.companyCode);
      return {
        id: String(link._id),
        documentId: String(link.documentId),
        documentTitle: document.title,
        legalDocumentId: String(link.legalDocumentId),
        legalNumber: snapshot.number,
        status: knowledgeReviewStatus(link, knowledgeReviewRevision(document), snapshot),
        state: link.state,
        matchKind: link.matchKind,
        sample:
          link.matchedRevision === knowledgeReviewRevision(document)
            ? link.sample
            : "Bản nội bộ đã đổi; mở nội dung hiện tại để kiểm tra.",
        matchedChunkIndexes: link.matchedRevision === knowledgeReviewRevision(document) ? link.matchedChunkIndexes : [],
        relation: link.relation,
        scope: link.scope,
        chunkIndexes: link.selectedChunkIndexes || link.chunkIndexes,
        sectionKeys: link.sectionKeys,
        sectionChoices: allSections.sectionKeys,
        legalAvailable: snapshot.available,
        knowledgeRevision: knowledgeReviewRevision(document),
        legalFingerprint: allSections.fingerprint,
        reviewVersion: link.updatedAt.toISOString(),
        history: link.history.slice(-20),
      };
    }),
  };
}
export async function knowledgeLegalReviewDetail(context: AssistantAccessContext, id: string) {
  const document = await visibleDocument(context, id);
  return {
    id: String(document._id),
    title: document.title,
    revision: knowledgeReviewRevision(document),
    chunks: await reviewDocumentChunks(document),
  };
}
export async function scanVisibleKnowledgeLegalReviews(context: AssistantAccessContext) {
  requireManage(context);
  const documents = (await visibleReviewDocuments(context)).filter((d) => d.status === "active");
  const catalog = await loadLegalReviewCatalog();
  const pending = documents.filter(
    (d) => d.legalScanCatalog !== catalog.version || d.legalScannedUpdatedAt?.getTime() !== d.updatedAt?.getTime(),
  );
  let scanned = 0,
    matches = 0;
  for (const document of pending.slice(0, 20)) {
    matches += await scanKnowledgeLegalDocument(document, catalog);
    await AssistantKnowledgeDocumentModel.updateOne(
      { _id: document._id, companyCode: context.companyCode, updatedAt: document.updatedAt },
      { $set: { legalScanCatalog: catalog.version, legalScannedUpdatedAt: document.updatedAt } },
      { timestamps: false },
    );
    scanned++;
  }
  return { scanned, matches, remaining: Math.max(0, pending.length - scanned) };
}
export async function proposeManualLegalReview(
  context: AssistantAccessContext,
  documentId: string,
  legalDocumentId: string,
) {
  requireManage(context);
  if (!Types.ObjectId.isValid(legalDocumentId)) throw new Error("Mã văn bản pháp lý không hợp lệ.");
  const document = await visibleDocument(context, documentId);
  const catalog = await loadLegalReviewCatalog();
  const law = catalog.laws.find((law) => String(law._id) === legalDocumentId && legalApplies(law, context.companyCode));
  if (!law) throw new Error("Văn bản pháp lý không thuộc phạm vi doanh nghiệp.");
  await KnowledgeLegalReviewModel.init();
  const selector = { companyCode: context.companyCode, documentId: document._id, legalDocumentId: law._id };
  const createdAt = new Date();
  try {
    await KnowledgeLegalReviewModel.updateOne(
      selector,
      {
        $setOnInsert: {
          ...selector,
          createdAt,
          updatedAt: createdAt,
          state: "suggested",
          matchKind: "manual",
          matchedRevision: knowledgeReviewRevision(document),
        },
      },
      { upsert: true, timestamps: false },
    );
  } catch (error: any) {
    if (error.code !== 11000) throw error;
  }
  return { success: true };
}
const decisionSchema = Joi.object({
  decision: Joi.string().valid("copy", "reference", "dismiss").required(),
  scope: Joi.string().valid("document", "chunks").required(),
  chunkIndexes: Joi.array().items(Joi.number().integer().min(0)).unique().max(1000).required(),
  sectionKeys: Joi.array().items(Joi.string().max(100)).unique().max(500).required(),
  knowledgeRevision: Joi.string().max(200).required(),
  legalFingerprint: Joi.string().max(100).required(),
  reviewVersion: Joi.string().isoDate().required(),
  reviewed: Joi.boolean().valid(true).required(),
  note: Joi.string().trim().max(2000).allow("").required(),
}).unknown(false);
export async function decideKnowledgeLegalReview(context: AssistantAccessContext, id: string, body: unknown) {
  requireManage(context);
  const parsed = decisionSchema.validate(body);
  if (parsed.error) throw new Error(parsed.error.message);
  const input = parsed.value;
  const link = await KnowledgeLegalReviewModel.findOne({ _id: id, companyCode: context.companyCode }).lean();
  if (!link) throw new Error("Không tìm thấy đối chiếu trong doanh nghiệp.");
  const document = await visibleDocument(context, String(link.documentId));
  const catalog = await loadLegalReviewCatalog();
  const allSections = legalDependencySnapshot(link.legalDocumentId, [], catalog.laws, context.companyCode);
  if (
    input.knowledgeRevision !== knowledgeReviewRevision(document) ||
    input.legalFingerprint !== allSections.fingerprint ||
    input.reviewVersion !== link.updatedAt.toISOString()
  )
    throw new Error("Tài liệu, pháp lý hoặc quyết định đã thay đổi. Vui lòng tải lại trước khi xác nhận.");
  if (input.sectionKeys.some((key: string) => !allSections.sectionKeys.includes(key)))
    throw new Error("Điều/khoản được theo dõi không tồn tại.");
  if (
    input.decision === "copy" &&
    (input.scope !== "document" || input.sectionKeys.length || input.chunkIndexes.length)
  )
    throw new Error("Bản sao pháp lý phải liên kết toàn tài liệu với nguồn chung.");
  const snapshot = legalDependencySnapshot(link.legalDocumentId, input.sectionKeys, catalog.laws, context.companyCode);
  if (input.decision === "reference" && !snapshot.available)
    throw new Error("Căn cứ không còn hiệu lực; hãy cập nhật tài liệu hoặc chọn căn cứ mới trước khi xác nhận.");
  let chunkIndexes: number[] = [];
  if (input.scope === "chunks" && input.decision === "reference") {
    const chunks = await reviewDocumentChunks(document);
    const available = chunks.map((chunk) => chunk.chunkIndex);
    if (!input.chunkIndexes.length || input.chunkIndexes.some((index: number) => !available.includes(index)))
      throw new Error("Chọn ít nhất một đoạn hiện có trong tài liệu.");
    chunkIndexes = expandedReviewChunks(input.chunkIndexes, available);
  }
  const now = new Date();
  const update = await KnowledgeLegalReviewModel.findOneAndUpdate(
    { _id: id, companyCode: context.companyCode, updatedAt: link.updatedAt },
    {
      $set: {
        state: input.decision === "dismiss" ? "dismissed" : "confirmed",
        relation: input.decision === "dismiss" ? link.relation : input.decision,
        scope: input.scope,
        chunkIndexes,
        selectedChunkIndexes: input.chunkIndexes,
        sectionKeys: input.sectionKeys,
        reviewedRevision: knowledgeReviewRevision(document),
        reviewedLegalFingerprint: snapshot.fingerprint,
        reviewedBy: context.userId,
        reviewedAt: now,
      },
      $push: {
        history: {
          action: input.decision,
          actor: context.userId,
          at: now,
          revision: knowledgeReviewRevision(document),
          legalFingerprint: snapshot.fingerprint,
          relation: input.decision,
          scope: input.scope,
          chunkIndexes,
          sectionKeys: input.sectionKeys,
          note: input.note,
        },
      },
    },
    { returnDocument: "after" },
  );
  if (!update) throw new Error("Quyết định vừa thay đổi. Vui lòng tải lại.");
  return { success: true };
}
