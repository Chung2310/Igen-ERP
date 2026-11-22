import { ERP_LLM_MODEL } from "../../../shared/llm-model";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { openrouterChat } from "../../service/openrouter.service";
import { LegalChunkModel, LegalDocumentModel, LegalReviewTaskModel, LegalSyncStateModel, LegalVersionModel } from "./models/legal-reference.model";
import { createLegalDocument, createLegalRevision, openLegalOriginal, replaceLegalReviewText, resolveLegalReview, type LegalDocumentInput, type LegalUpload } from "./services/legal-document.service";
import { embedLegalText, isLegalChunkApplicable, legalEmbeddingSimilarity, MAX_LEGAL_FILE_BYTES, scoreLegalMatch } from "./services/legal-reference.service";
import { isVbplSyncConfigured, startVbplSync } from "./services/vbpl-sync.service";

export const legalReferenceRouter = Router();
const readPermission = requirePermission("legal-reference:read");
const managePermission = requirePermission("legal-reference:manage");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LEGAL_FILE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(extension || "")) return callback(new Error("Chỉ hỗ trợ tệp PDF, Word (.docx) và văn bản (.txt)."));
    callback(null, true);
  },
});

function uploadOriginal(request: Request, response: Response, next: NextFunction) {
  upload.single("original")(request, response, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return response.status(status).json({ status: "error", message: error.message || "Không thể tải tệp lên." });
  });
}

function fail(response: Response, error: unknown, fallback: string) {
  const candidate = error as { status?: number; statusCode?: number; code?: number; message?: string };
  const status = candidate.status || candidate.statusCode || (candidate.code === 11000 ? 409 : 500);
  return response.status(status).json({ status: "error", message: candidate.code === 11000 ? "Số ký hiệu văn bản đã tồn tại trong kho." : candidate.message || fallback });
}

function userScope(request: AuthenticatedRequest) {
  const companyCode = request.user?.companyCode?.trim().toUpperCase();
  if (!companyCode) throw Object.assign(new Error("Không xác định được doanh nghiệp."), { status: 403 });
  return { companyCode, userId: request.user?.id || "" };
}

function escapeRegexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRelatedDocuments(value: unknown): LegalDocumentInput["relatedDocuments"] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 30).flatMap((item) => {
      if (!item || typeof item !== "object" || typeof item.symbol !== "string" || !item.symbol.trim()
        || !["amends", "consolidates", "related"].includes(item.relation)) return [];
      const affectedArticles = Array.isArray(item.affectedArticles)
        ? item.affectedArticles.filter((article: unknown): article is string => typeof article === "string").slice(0, 100)
        : [];
      return [{ symbol: item.symbol.trim().slice(0, 120), relation: item.relation, affectedArticles }];
    });
  } catch { return []; }
}

function documentInput(body: Record<string, unknown>): LegalDocumentInput {
  return {
    symbol: String(body.symbol || ""),
    title: String(body.title || ""),
    issuingAuthority: String(body.issuingAuthority || ""),
    jurisdiction: String(body.jurisdiction || "") as LegalDocumentInput["jurisdiction"],
    province: String(body.province || ""),
    field: String(body.field || ""),
    issueDate: String(body.issueDate || ""),
    effectiveDate: String(body.effectiveDate || ""),
    expiryDate: String(body.expiryDate || ""),
    status: String(body.status || "unknown") as LegalDocumentInput["status"],
    sourceUrl: String(body.sourceUrl || ""),
    sourceSystem: body.sourceSystem === "vbpl" ? "vbpl" : "uploaded",
    sourceDocumentId: String(body.sourceDocumentId || ""),
    isConsolidated: body.isConsolidated === "true" || body.isConsolidated === true,
    relatedDocuments: parseRelatedDocuments(body.relatedDocuments),
  };
}

legalReferenceRouter.get("/health", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const [documents, chunks, pendingReviews, latestVersion, syncState] = await Promise.all([
      LegalDocumentModel.countDocuments({ companyCode }),
      LegalChunkModel.countDocuments({ companyCode }),
      LegalReviewTaskModel.countDocuments({ companyCode, status: "pending" }),
      LegalVersionModel.findOne({ companyCode }).sort({ downloadedAt: -1 }).select("downloadedAt").lean(),
      LegalSyncStateModel.findOne({ companyCode }).select("status configuredScopes startedAt completedAt lastSuccessAt pagesScanned documentsFound documentsAdded revisionsAdded unchanged reviewRequired missingOriginal lastError").lean(),
    ]);
    return response.json({ documents, chunks, pendingReviews, latestDownloadAt: latestVersion?.downloadedAt || null, syncConfigured: isVbplSyncConfigured(), sync: syncState || null });
  } catch (error) { return fail(response, error, "Không thể tải tình trạng kho văn bản."); }
});

legalReferenceRouter.post("/sync", managePermission as never, async (request, response) => {
  try {
    const { companyCode, userId } = userScope(request as AuthenticatedRequest);
    if (!isVbplSyncConfigured()) return response.status(503).json({ status: "error", message: "Chưa cấu hình kết nối VBPL. Liên hệ quản trị hệ thống để thiết lập nguồn đồng bộ." });
    const requestedPageLimit = Number(request.body?.pageLimit);
    const pageLimit = Number.isInteger(requestedPageLimit) && requestedPageLimit >= 1 && requestedPageLimit <= 100 ? requestedPageLimit : undefined;
    if (!startVbplSync(companyCode, userId, pageLimit)) return response.status(409).json({ status: "error", message: "Một lần đồng bộ cho doanh nghiệp này đang chạy." });
    return response.status(202).json({ status: "accepted", message: "Đã bắt đầu đồng bộ. Kết quả sẽ hiện trong trạng thái kho." });
  } catch (error) { return fail(response, error, "Không thể bắt đầu đồng bộ VBPL."); }
});

legalReferenceRouter.get("/documents", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const q = String(request.query.q || "").trim().slice(0, 150);
    const query: Record<string, unknown> = { companyCode };
    if (["central", "ministry", "local"].includes(String(request.query.jurisdiction))) query.jurisdiction = String(request.query.jurisdiction);
    if (["effective", "partially_effective", "upcoming", "expired", "repealed", "unknown"].includes(String(request.query.status))) query.status = String(request.query.status);
    if (request.query.field) query.field = { $regex: escapeRegexLiteral(String(request.query.field).slice(0, 80)), $options: "i" };
    if (request.query.authority) query.issuingAuthority = { $regex: escapeRegexLiteral(String(request.query.authority).slice(0, 100)), $options: "i" };
    if (q) query.$or = [
      { symbol: { $regex: escapeRegexLiteral(q), $options: "i" } },
      { title: { $regex: escapeRegexLiteral(q), $options: "i" } },
      { issuingAuthority: { $regex: escapeRegexLiteral(q), $options: "i" } },
    ];
    const documents = await LegalDocumentModel.find(query).sort({ effectiveDate: -1, issueDate: -1, symbol: 1 }).limit(200).lean();
    const ids = documents.map((document) => document._id);
    const [versions, chunkCounts] = await Promise.all([
      LegalVersionModel.find({ companyCode, documentId: { $in: ids } }).sort({ versionNumber: -1 }).select("documentId versionNumber downloadedAt sha256 lifecycleStatus extractionStatus").lean(),
      LegalChunkModel.aggregate([{ $match: { companyCode, documentId: { $in: ids } } }, { $group: { _id: "$documentId", count: { $sum: 1 } } }]),
    ]);
    const latestByDocument = new Map<string, typeof versions[number]>();
    for (const version of versions) if (!latestByDocument.has(String(version.documentId))) latestByDocument.set(String(version.documentId), version);
    const chunksByDocument = new Map(chunkCounts.map((row) => [String(row._id), row.count]));
    return response.json({ documents: documents.map((document) => ({
      id: String(document._id),
      symbol: document.symbol,
      title: document.title,
      issuingAuthority: document.issuingAuthority,
      jurisdiction: document.jurisdiction,
      province: document.province,
      field: document.field,
      issueDate: document.issueDate,
      effectiveDate: document.effectiveDate,
      expiryDate: document.expiryDate,
      status: document.status,
      sourceUrl: document.sourceUrl,
      relatedDocuments: document.relatedDocuments,
      reviewRequired: document.reviewRequired,
      currentVersionId: document.currentVersionId ? String(document.currentVersionId) : "",
      latestVersion: latestByDocument.get(String(document._id)) || null,
      chunksCount: chunksByDocument.get(String(document._id)) || 0,
    })) });
  } catch (error) { return fail(response, error, "Không thể tải danh sách văn bản."); }
});

legalReferenceRouter.post("/documents", managePermission as never, uploadOriginal, async (request, response) => {
  try {
    const { companyCode, userId } = userScope(request as AuthenticatedRequest);
    if (!request.file) return response.status(400).json({ status: "error", message: "Chọn bản gốc PDF, Word (.docx) hoặc TXT." });
    const result = await createLegalDocument(companyCode, userId, documentInput(request.body || {}), request.file as LegalUpload);
    return response.status(201).json({
      status: "success",
      document: { id: String(result.document._id), symbol: result.document.symbol, title: result.document.title, reviewRequired: result.document.reviewRequired },
      version: { versionNumber: result.version.versionNumber, sha256: result.version.sha256, downloadedAt: result.version.downloadedAt },
      chunksCount: result.chunksCount,
      extractionStatus: result.extractionStatus,
    });
  } catch (error) { return fail(response, error, "Không thể lưu văn bản pháp luật."); }
});

legalReferenceRouter.post("/documents/:id/revisions", managePermission as never, uploadOriginal, async (request, response) => {
  try {
    const { companyCode, userId } = userScope(request as AuthenticatedRequest);
    if (!request.file) return response.status(400).json({ status: "error", message: "Chọn bản gốc của phiên bản mới." });
    const result = await createLegalRevision(companyCode, userId, String(request.params.id), request.file as LegalUpload, String(request.body?.sourceUrl || ""));
    if (result.duplicate) return response.json({ status: "unchanged", ...result });
    return response.status(201).json({ status: "success", ...result, reviewRequired: true });
  } catch (error) { return fail(response, error, "Không thể lưu phiên bản mới."); }
});

legalReferenceRouter.get("/documents/:id/original", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const version = await LegalVersionModel.findOne({ _id: request.params.id, companyCode }).select("originalFileId originalFilename mimeType").lean();
    if (!version?.originalFileId) return response.status(404).json({ status: "error", message: "Không tìm thấy bản gốc." });
    const original = await openLegalOriginal(String(version.originalFileId), companyCode);
    if (!original) return response.status(404).json({ status: "error", message: "Không tìm thấy bản gốc." });
    response.setHeader("Content-Type", version.mimeType || original.contentType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(version.originalFilename)}`);
    original.stream.on("error", (error) => { if (!response.headersSent) fail(response, error, "Không thể tải bản gốc."); });
    return original.stream.pipe(response);
  } catch (error) { return fail(response, error, "Không thể tải bản gốc."); }
});

legalReferenceRouter.get("/review-queue", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const tasks = await LegalReviewTaskModel.find({ companyCode, status: "pending" }).sort({ createdAt: 1 }).limit(200).lean();
    const documentIds = [...new Set(tasks.map((task) => String(task.documentId)))];
    const documents = await LegalDocumentModel.find({ companyCode, _id: { $in: documentIds } }).select("symbol title issuingAuthority sourceUrl effectiveDate").lean();
    const documentMap = new Map(documents.map((document) => [String(document._id), document]));
    const versions = await LegalVersionModel.find({ companyCode, _id: { $in: tasks.map((task) => task.versionId) } }).select("_id versionNumber sha256 extractionStatus downloadedAt originalFilename").lean();
    const versionMap = new Map(versions.map((version) => [String(version._id), version]));
    return response.json({ tasks: tasks.map((task) => ({
      id: String(task._id),
      taskType: task.taskType,
      reason: task.reason,
      createdAt: task.createdAt,
      details: task.taskType === "amendment" ? { relatedDocuments: task.details?.relatedDocuments || [] } : {},
      document: documentMap.get(String(task.documentId)) || null,
      version: (() => {
        const version = versionMap.get(String(task.versionId));
        return version ? { ...version, id: String(version._id) } : null;
      })(),
    })) });
  } catch (error) { return fail(response, error, "Không thể tải hàng rà soát."); }
});

legalReferenceRouter.post("/review-queue/:id/content", managePermission as never, async (request, response) => {
  try {
    const { companyCode, userId } = userScope(request as AuthenticatedRequest);
    const text = typeof request.body?.text === "string" ? request.body.text : "";
    const result = await replaceLegalReviewText(companyCode, userId, String(request.params.id), text);
    return response.json({ status: "success", ...result });
  } catch (error) { return fail(response, error, "Không thể cập nhật nội dung trích xuất."); }
});

legalReferenceRouter.post("/review-queue/:id/decision", managePermission as never, async (request, response) => {
  try {
    const { companyCode, userId } = userScope(request as AuthenticatedRequest);
    const decision = request.body?.decision;
    if (decision !== "approve" && decision !== "reject") return response.status(400).json({ status: "error", message: "Chọn duyệt hoặc từ chối kết quả rà soát." });
    const effectiveFrom = typeof request.body?.effectiveFrom === "string" ? request.body.effectiveFrom : undefined;
    const result = await resolveLegalReview(companyCode, userId, String(request.params.id), decision, effectiveFrom);
    return response.json({ status: "success", ...result });
  } catch (error) { return fail(response, error, "Không thể lưu kết quả rà soát."); }
});

type LegalSearchFilters = { jurisdiction?: string; field?: string; authority?: string };
type LegalMatch = {
  score: number; keywordScore: number; embeddingScore: number; text: string; symbol: string; title: string;
  issuingAuthority: string; field?: string; status: string; chapter?: string; article?: string; clause?: string;
  point?: string; versionNumber: number; sourceUrl: string;
};

async function findLegalMatches(companyCode: string, queryText: string, asOf: Date, filters: LegalSearchFilters): Promise<LegalMatch[]> {
  const docQuery: Record<string, unknown> = { companyCode };
  if (filters.jurisdiction && ["central", "ministry", "local"].includes(filters.jurisdiction)) docQuery.jurisdiction = filters.jurisdiction;
  if (filters.field) docQuery.field = { $regex: escapeRegexLiteral(filters.field.slice(0, 80)), $options: "i" };
  if (filters.authority) docQuery.issuingAuthority = { $regex: escapeRegexLiteral(filters.authority.slice(0, 100)), $options: "i" };
  const documents = await LegalDocumentModel.find(docQuery).select("_id symbol title issuingAuthority sourceUrl field status currentVersionId").limit(500).lean();
  const usableDocuments = documents.filter((document) => Boolean(document.currentVersionId));
  const versions = await LegalVersionModel.find({
    companyCode,
    documentId: { $in: usableDocuments.map((document) => document._id) },
    lifecycleStatus: { $in: ["current", "superseded"] },
  }).select("_id documentId versionNumber effectiveFrom effectiveTo lifecycleStatus extractionStatus").lean();
  const versionMap = new Map(versions.map((version) => [String(version._id), version]));
  const versionIds = versions.map((version) => version._id);
  const chunks = await LegalChunkModel.find({ companyCode, versionId: { $in: versionIds }, $text: { $search: queryText } }).sort({ score: { $meta: "textScore" } }).limit(5_000).lean();
  const documentMap = new Map(usableDocuments.map((document) => [String(document._id), document]));
  const queryEmbedding = embedLegalText(queryText);
  return chunks.flatMap((chunk) => {
    const document = documentMap.get(String(chunk.documentId));
    const version = versionMap.get(String(chunk.versionId));
    if (!document || !version || version.extractionStatus !== "indexed") return [];
    if (!isLegalChunkApplicable({ status: chunk.status, effectiveFrom: version.effectiveFrom || chunk.effectiveFrom, effectiveTo: version.effectiveTo || chunk.effectiveTo }, asOf)) return [];
    const keywordScore = scoreLegalMatch(queryText, chunk.text, `${document.symbol} ${document.title} ${chunk.article} ${chunk.clause}`);
    const embeddingScore = legalEmbeddingSimilarity(queryEmbedding, chunk.embedding || embedLegalText(chunk.text));
    const score = keywordScore + Math.max(0, embeddingScore) * 0.25;
    return score > 0 ? [{
      score, keywordScore, embeddingScore, text: chunk.text, symbol: document.symbol, title: document.title,
      issuingAuthority: document.issuingAuthority, field: document.field, status: chunk.status, article: chunk.article,
      clause: chunk.clause, point: chunk.point, chapter: chunk.chapter, versionNumber: version.versionNumber,
      sourceUrl: document.sourceUrl || chunk.sourceUrl,
    }] : [];
  }).sort((left, right) => right.score - left.score).slice(0, 20);
}

function parseSearchInput(body: Record<string, unknown>) {
  const query = String(body.query || "").trim().slice(0, 500);
  const asOfText = String(body.asOf || "");
  const asOf = asOfText ? new Date(asOfText) : new Date();
  return { query, asOf, filters: { jurisdiction: String(body.jurisdiction || ""), field: String(body.field || "").trim(), authority: String(body.authority || "").trim() } };
}

legalReferenceRouter.post("/search", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const { query, asOf, filters } = parseSearchInput(request.body || {});
    if (!query) return response.status(400).json({ status: "error", message: "Nhập nội dung cần tra cứu." });
    if (Number.isNaN(asOf.getTime())) return response.status(400).json({ status: "error", message: "Ngày tra cứu không hợp lệ." });
    const matches = await findLegalMatches(companyCode, query, asOf, filters);
    return response.json({ query, asOf: asOf.toISOString(), matches });
  } catch (error) { return fail(response, error, "Không thể tra cứu kho văn bản."); }
});

legalReferenceRouter.post("/answer", readPermission as never, async (request, response) => {
  try {
    const { companyCode } = userScope(request as AuthenticatedRequest);
    const { query, asOf, filters } = parseSearchInput(request.body || {});
    if (!query) return response.status(400).json({ status: "error", message: "Nhập nội dung cần tra cứu." });
    if (Number.isNaN(asOf.getTime())) return response.status(400).json({ status: "error", message: "Ngày tra cứu không hợp lệ." });
    const matches = await findLegalMatches(companyCode, query, asOf, filters);
    const sources = matches.slice(0, 8).map((match, index) => ({ citation: `[${index + 1}]`, ...match }));
    if (!sources.length) return response.json({ query, asOf: asOf.toISOString(), answer: "Kho văn bản chưa có đoạn đã được xác nhận phù hợp với câu hỏi tại ngày đã chọn.", sources });
    const context = sources.map((source) => `${source.citation} ${source.symbol}, ${[source.chapter, source.article, source.clause && `Khoản ${source.clause}`, source.point && `Điểm ${source.point}`].filter(Boolean).join(" / ")} (bản ${source.versionNumber}, ${source.sourceUrl})\n${source.text}`).join("\n\n");
    const result = await openrouterChat({
      model: ERP_LLM_MODEL,
      temperature: 0.1,
      maxTokens: 1200,
      messages: [
        { role: "system", content: "Bạn là trợ lý tra cứu văn bản pháp luật Việt Nam. Chỉ trả lời dựa trên các đoạn nguồn được cung cấp; không suy diễn hiệu lực hoặc nội dung điều khoản ngoài nguồn. Mọi nhận định pháp lý phải có mã trích dẫn [1], [2] tương ứng ngay trong câu. Nếu nguồn chưa đủ để kết luận, nói rõ phần chưa xác định và đề nghị kiểm tra văn bản gốc. Trả lời bằng tiếng Việt, ngắn gọn, giữ nguyên số Điều/Khoản/Điểm." },
        { role: "user", content: `Câu hỏi: ${query}\nNgày cần áp dụng: ${asOf.toISOString().slice(0, 10)}\n\nĐoạn nguồn đã lọc theo ngày áp dụng:\n${context}` },
      ],
    });
    return response.json({ query, asOf: asOf.toISOString(), answer: result.text, sources });
  } catch (error) { return fail(response, error, "Không thể tạo câu trả lời từ kho văn bản."); }
});
