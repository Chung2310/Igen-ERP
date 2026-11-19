import mongoose, { Types } from "mongoose";
import { Readable } from "node:stream";
import { LegalChunkModel, LegalDocumentModel, LegalReviewTaskModel, LegalVersionModel, type LegalJurisdiction, type LegalStatus } from "../models/legal-reference.model";
import { embedLegalText, extractLegalText, MAX_LEGAL_FILE_BYTES, sha256, splitLegalStructure } from "./legal-reference.service";

export type LegalDocumentInput = {
  symbol: string;
  title: string;
  issuingAuthority: string;
  jurisdiction: LegalJurisdiction;
  province?: string;
  field?: string;
  issueDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  status?: LegalStatus;
  sourceUrl?: string;
  sourceSystem?: "vbpl" | "uploaded";
  sourceDocumentId?: string;
  sourceModifiedAt?: string;
  requiresRelationReview?: boolean;
  isConsolidated?: boolean;
  relatedDocuments?: Array<{ symbol: string; relation: "amends" | "consolidates" | "related"; affectedArticles: string[] }>;
};

export type LegalUpload = { buffer: Buffer; originalname: string; mimetype: string };

function parsedDate(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function safeFilename(value: string): string {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(-180) || "van-ban";
}

function legalMimeType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "txt") return "text/plain; charset=utf-8";
  if (extension === "html" || extension === "htm") return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function getGridFsBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Kho lưu trữ chưa kết nối cơ sở dữ liệu.");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "legalReferenceOriginals" });
}

export async function storeLegalOriginal(file: LegalUpload, companyCode: string, digest: string): Promise<Types.ObjectId> {
  if (!file.buffer.length || file.buffer.length > MAX_LEGAL_FILE_BYTES) throw new Error("Tệp phải có dung lượng từ 1 byte đến 20 MB.");
  const bucket = getGridFsBucket();
  const upload = bucket.openUploadStream(safeFilename(file.originalname), {
    metadata: { companyCode: companyCode.toUpperCase(), sha256: digest, contentType: legalMimeType(file.originalname), uploadedAt: new Date() },
  });
  await new Promise<void>((resolve, reject) => {
    Readable.from([file.buffer]).pipe(upload).on("error", reject);
    upload.on("finish", resolve);
    upload.on("error", reject);
  });
  return new Types.ObjectId(upload.id.toHexString());
}

export function openLegalOriginal(fileId: string, companyCode: string) {
  if (!Types.ObjectId.isValid(fileId)) return null;
  const bucket = getGridFsBucket();
  const id = new mongoose.mongo.ObjectId(fileId);
  return bucket.find({ _id: id, "metadata.companyCode": companyCode.toUpperCase() }).hasNext().then(async (exists) => {
    if (!exists) return null;
    const file = await bucket.find({ _id: id }).next();
    if (!file) return null;
    return { filename: file.filename, contentType: String(file.metadata?.contentType || "application/octet-stream"), stream: bucket.openDownloadStream(id) };
  });
}

function validateInput(input: LegalDocumentInput): string | undefined {
  if (!input.symbol?.trim() || input.symbol.trim().length > 120) return "Nhập số, ký hiệu văn bản (tối đa 120 ký tự).";
  if (!input.title?.trim() || input.title.trim().length > 500) return "Nhập tên văn bản (tối đa 500 ký tự).";
  if (!input.issuingAuthority?.trim() || input.issuingAuthority.trim().length > 250) return "Nhập cơ quan ban hành (tối đa 250 ký tự).";
  if (!["central", "ministry", "local"].includes(input.jurisdiction)) return "Phạm vi văn bản không hợp lệ.";
  if (!["effective", "partially_effective", "upcoming", "expired", "repealed", "unknown"].includes(input.status || "unknown")) return "Trạng thái văn bản không hợp lệ.";
  if (input.status !== "unknown" && !input.effectiveDate) return "Nhập ngày hiệu lực hoặc chọn trạng thái chưa xác định.";
  if ((input.status === "expired" || input.status === "repealed") && !input.expiryDate) return "Nhập ngày hết hiệu lực hoặc chọn trạng thái chưa xác định.";
  for (const value of [input.issueDate, input.effectiveDate, input.expiryDate]) {
    if (value && !parsedDate(value)) return "Ngày văn bản không hợp lệ.";
  }
  if (input.sourceUrl?.trim()) {
    try { if (!["http:", "https:"].includes(new URL(input.sourceUrl).protocol)) return "Liên kết nguồn phải dùng HTTP hoặc HTTPS."; }
    catch { return "Liên kết nguồn không hợp lệ."; }
  }
  if (input.sourceSystem === "vbpl") {
    if (!input.sourceUrl?.trim()) return "Nhập liên kết văn bản trên VBPL.";
    try {
      const hostname = new URL(input.sourceUrl).hostname.toLowerCase();
      if (!(hostname === "vbpl.vn" || hostname.endsWith(".vbpl.vn") || hostname === "vbpl.moj.gov.vn" || hostname === "data.moj.gov.vn")) return "Nguồn VBPL cần dùng tên miền vbpl.vn hoặc data.moj.gov.vn.";
    } catch { return "Liên kết nguồn không hợp lệ."; }
  }
  return undefined;
}

async function indexVersion(input: {
  companyCode: string;
  documentId: Types.ObjectId;
  versionId: Types.ObjectId;
  text: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  metadata: Pick<LegalDocumentInput, "issuingAuthority" | "field" | "status" | "sourceUrl">;
}) {
  const structure = splitLegalStructure(input.text);
  if (!structure.length) return 0;
  await LegalChunkModel.insertMany(structure.map((chunk, chunkIndex) => ({
    companyCode: input.companyCode,
    documentId: input.documentId,
    versionId: input.versionId,
    chunkIndex,
    ...chunk,
    embedding: embedLegalText(chunk.text),
    issuingAuthority: input.metadata.issuingAuthority,
    field: input.metadata.field || "",
    status: input.metadata.status || "unknown",
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    sourceUrl: input.metadata.sourceUrl || "",
  })));
  return structure.length;
}

export async function createLegalDocument(companyCodeInput: string, userId: string, input: LegalDocumentInput, file: LegalUpload) {
  const validationError = validateInput(input);
  if (validationError) throw Object.assign(new Error(validationError), { status: 400 });
  const companyCode = companyCodeInput.trim().toUpperCase();
  const symbol = input.symbol.trim();
  const existing = await LegalDocumentModel.findOne({ companyCode, symbol }).select("_id").lean();
  if (existing) throw Object.assign(new Error("Số ký hiệu này đã có trong kho văn bản."), { status: 409 });

  const digest = sha256(file.buffer);
  const storedFileId = await storeLegalOriginal(file, companyCode, digest);
  let extractedText = "";
  let extractionError = "";
  try { extractedText = await extractLegalText(file.buffer, file.originalname); }
  catch (error) { extractionError = error instanceof Error ? error.message : "Không thể đọc nội dung tệp."; }
  const chunks = extractedText ? splitLegalStructure(extractedText) : [];
  const extractionStatus = chunks.length ? "indexed" as const : "needs_review" as const;
  let documentId: Types.ObjectId | undefined;

  try {
    const document = await LegalDocumentModel.create({
      companyCode,
      sourceSystem: input.sourceSystem || "uploaded",
      sourceDocumentId: input.sourceDocumentId?.trim() || "",
      symbol,
      title: input.title.trim(),
      issuingAuthority: input.issuingAuthority.trim(),
      jurisdiction: input.jurisdiction,
      province: input.province?.trim() || "",
      field: input.field?.trim() || "",
      issueDate: parsedDate(input.issueDate),
      effectiveDate: parsedDate(input.effectiveDate),
      expiryDate: parsedDate(input.expiryDate),
      status: input.status || "unknown",
      sourceUrl: input.sourceUrl?.trim() || "",
      relatedDocuments: (input.relatedDocuments || []).map((item) => ({ ...item, reviewStatus: "needs_review" })),
      reviewRequired: extractionStatus !== "indexed" || Boolean(input.relatedDocuments?.length) || Boolean(input.requiresRelationReview),
      createdBy: userId,
    });
    documentId = document._id as Types.ObjectId;
    const version = await LegalVersionModel.create({
      companyCode,
      documentId,
      versionNumber: 1,
      sourceUrl: input.sourceUrl?.trim() || "",
      sourceModifiedAt: parsedDate(input.sourceModifiedAt),
      downloadedAt: new Date(),
      originalFileId: storedFileId,
      originalFilename: safeFilename(file.originalname),
      mimeType: file.mimetype || "application/octet-stream",
      byteLength: file.buffer.length,
      sha256: digest,
      extractedText,
      textHash: extractedText ? sha256(extractedText) : "",
      extractionStatus,
      lifecycleStatus: extractionStatus === "indexed" ? "current" : "pending_review",
      isConsolidated: Boolean(input.isConsolidated),
      effectiveFrom: parsedDate(input.effectiveDate),
      effectiveTo: parsedDate(input.expiryDate),
      createdBy: userId,
    });
    const indexedCount = extractionStatus === "indexed" ? await indexVersion({
      companyCode,
      documentId,
      versionId: version._id as Types.ObjectId,
      text: extractedText,
      effectiveFrom: parsedDate(input.effectiveDate),
      effectiveTo: parsedDate(input.expiryDate),
      metadata: { issuingAuthority: input.issuingAuthority.trim(), field: input.field, status: input.status || "unknown", sourceUrl: input.sourceUrl },
    }) : 0;
    if (indexedCount > 0) document.currentVersionId = version._id as Types.ObjectId;
    if (indexedCount !== chunks.length) document.reviewRequired = true;
    await document.save();
    if (extractionStatus !== "indexed") {
      await LegalReviewTaskModel.create({
        companyCode,
        documentId,
        versionId: version._id,
        taskType: "extraction",
        reason: extractionError || "Không nhận diện chắc chắn cấu trúc Chương/Điều/Khoản/Điểm.",
        details: { structuralChunks: chunks.length },
      });
    }
    if (input.relatedDocuments?.length) await LegalReviewTaskModel.create({
      companyCode,
      documentId,
      versionId: version._id,
      taskType: "amendment",
      reason: "Liên kết sửa đổi, bổ sung hoặc văn bản hợp nhất cần được người quản lý xác minh.",
      details: { relatedDocuments: input.relatedDocuments.map(({ symbol, relation, affectedArticles }) => ({ symbol, relation, affectedArticles })) },
    });
    else if (input.requiresRelationReview) await LegalReviewTaskModel.create({
      companyCode,
      documentId,
      versionId: version._id,
      taskType: "amendment",
      reason: "Nguồn có thông tin văn bản sửa đổi hoặc hợp nhất nhưng chưa xác định chắc văn bản đích và điều khoản bị tác động.",
      details: { relatedDocuments: [] },
    });
    return { document, version, chunksCount: indexedCount, extractionStatus };
  } catch (error) {
    getGridFsBucket().delete(storedFileId).catch(() => undefined);
    if (documentId) {
      await Promise.all([
        LegalChunkModel.deleteMany({ companyCode, documentId }),
        LegalVersionModel.deleteMany({ companyCode, documentId }),
        LegalReviewTaskModel.deleteMany({ companyCode, documentId }),
        LegalDocumentModel.deleteOne({ _id: documentId, companyCode }),
      ]).catch(() => undefined);
    }
    throw error;
  }
}

export async function createLegalRevision(
  companyCodeInput: string,
  userId: string,
  documentIdInput: string,
  file: LegalUpload,
  sourceUrl = "",
  sourceModifiedAt?: string,
  sourceMetadata?: { status?: LegalStatus; effectiveDate?: string; expiryDate?: string },
) {
  if (!Types.ObjectId.isValid(documentIdInput)) throw Object.assign(new Error("Mã văn bản không hợp lệ."), { status: 400 });
  const companyCode = companyCodeInput.trim().toUpperCase();
  const document = await LegalDocumentModel.findOne({ _id: documentIdInput, companyCode });
  if (!document) throw Object.assign(new Error("Không tìm thấy văn bản."), { status: 404 });
  if (sourceUrl.trim()) {
    try { if (!["http:", "https:"].includes(new URL(sourceUrl).protocol)) throw new Error(); }
    catch { throw Object.assign(new Error("Liên kết nguồn phải là URL HTTP hoặc HTTPS hợp lệ."), { status: 400 }); }
  }
  const digest = sha256(file.buffer);
  const duplicate = await LegalVersionModel.findOne({ companyCode, documentId: document._id, sha256: digest }).select("versionNumber sourceModifiedAt sourceUrl sourceStatus sourceEffectiveDate sourceExpiryDate lifecycleStatus effectiveFrom effectiveTo");
  if (duplicate) {
    const modifiedAt = parsedDate(sourceModifiedAt);
    if (sourceUrl.trim()) duplicate.sourceUrl = sourceUrl.trim();
    if (sourceMetadata) {
      duplicate.sourceStatus = sourceMetadata.status || duplicate.sourceStatus;
      duplicate.sourceEffectiveDate = parsedDate(sourceMetadata.effectiveDate) || duplicate.sourceEffectiveDate;
      duplicate.sourceExpiryDate = parsedDate(sourceMetadata.expiryDate) || duplicate.sourceExpiryDate;
      if (duplicate.lifecycleStatus === "current") {
        duplicate.effectiveFrom = duplicate.sourceEffectiveDate || duplicate.effectiveFrom;
        duplicate.effectiveTo = duplicate.sourceExpiryDate || duplicate.effectiveTo;
      }
    }
    if (modifiedAt && (!duplicate.sourceModifiedAt || modifiedAt > duplicate.sourceModifiedAt)) {
      duplicate.sourceModifiedAt = modifiedAt;
    }
    await duplicate.save();
    return { duplicate: true, versionNumber: duplicate.versionNumber, chunksCount: 0 };
  }

  const fileId = await storeLegalOriginal(file, companyCode, digest);
  let extractedText = "";
  let extractionError = "";
  try { extractedText = await extractLegalText(file.buffer, file.originalname); }
  catch (error) { extractionError = error instanceof Error ? error.message : "Không thể đọc nội dung tệp."; }
  const structure = extractedText ? splitLegalStructure(extractedText) : [];
  const previous = document.currentVersionId
    ? await LegalVersionModel.findOne({ _id: document.currentVersionId, companyCode, documentId: document._id }).lean()
    : null;
  const versionNumber = await LegalVersionModel.countDocuments({ companyCode, documentId: document._id }) + 1;
  const version = await LegalVersionModel.create({
    companyCode,
    documentId: document._id,
    versionNumber,
    sourceUrl: sourceUrl.trim() || document.sourceUrl,
    sourceModifiedAt: parsedDate(sourceModifiedAt),
    downloadedAt: new Date(),
    originalFileId: fileId,
    originalFilename: safeFilename(file.originalname),
    mimeType: file.mimetype || "application/octet-stream",
    byteLength: file.buffer.length,
    sha256: digest,
    extractedText,
    textHash: extractedText ? sha256(extractedText) : "",
    extractionStatus: structure.length ? "indexed" : "needs_review",
    lifecycleStatus: "pending_review",
    isConsolidated: false,
    supersedesVersionId: previous?._id,
    effectiveTo: document.expiryDate,
    sourceStatus: sourceMetadata?.status,
    sourceEffectiveDate: parsedDate(sourceMetadata?.effectiveDate),
    sourceExpiryDate: parsedDate(sourceMetadata?.expiryDate),
    createdBy: userId,
  });
  const indexedCount = structure.length ? await indexVersion({
    companyCode,
    documentId: document._id as Types.ObjectId,
    versionId: version._id as Types.ObjectId,
    text: extractedText,
    metadata: { issuingAuthority: document.issuingAuthority, field: document.field, status: document.status, sourceUrl: version.sourceUrl },
  }) : 0;
  document.reviewRequired = true;
  await document.save();
  await LegalReviewTaskModel.create({
    companyCode,
    documentId: document._id,
    versionId: version._id,
    taskType: previous ? "version_change" : "extraction",
    reason: extractionError || (previous ? "Có phiên bản mới; cần xác nhận ngày áp dụng và phần bị tác động." : "Cần xác nhận kết quả trích xuất trước khi đưa vào tra cứu."),
    details: { previousVersionId: previous?._id?.toString() || "", structuralChunks: indexedCount },
  });
  return { duplicate: false, versionNumber, chunksCount: indexedCount };
}

export async function resolveLegalReview(companyCodeInput: string, userId: string, reviewId: string, decision: "approve" | "reject", effectiveFrom?: string) {
  if (!Types.ObjectId.isValid(reviewId)) throw Object.assign(new Error("Mã yêu cầu rà soát không hợp lệ."), { status: 400 });
  const companyCode = companyCodeInput.trim().toUpperCase();
  const task = await LegalReviewTaskModel.findOne({ _id: reviewId, companyCode, status: "pending" });
  if (!task) throw Object.assign(new Error("Không tìm thấy yêu cầu đang chờ rà soát."), { status: 404 });
  const version = await LegalVersionModel.findOne({ _id: task.versionId, companyCode, documentId: task.documentId });
  const document = await LegalDocumentModel.findOne({ _id: task.documentId, companyCode });
  if (!version || !document) throw Object.assign(new Error("Dữ liệu văn bản cần rà soát không còn đầy đủ."), { status: 409 });
  const effectiveDate = parsedDate(effectiveFrom) || (task.taskType === "extraction" ? document.effectiveDate : undefined);
  if (decision === "approve" && task.taskType === "version_change" && !effectiveDate) {
    throw Object.assign(new Error("Xác nhận ngày bắt đầu áp dụng trước khi duyệt phiên bản mới."), { status: 400 });
  }
  if (decision === "approve" && task.taskType !== "amendment" && version.extractionStatus !== "indexed") {
    throw Object.assign(new Error("Chưa có nội dung được tách theo Điều/Khoản để xác nhận. Hãy bổ sung nội dung trích xuất trước."), { status: 422 });
  }
  if (decision === "approve") {
    if (task.taskType === "amendment") {
      const relationSymbols = new Set((task.details?.relatedDocuments as Array<{ symbol?: string }> | undefined || []).map((item) => String(item.symbol || "").trim().toLocaleLowerCase("vi-VN")));
      document.relatedDocuments = document.relatedDocuments.map((relation) => relationSymbols.has(relation.symbol.toLocaleLowerCase("vi-VN")) ? { ...relation, reviewStatus: "verified" } : relation);
    } else {
      const previousId = version.supersedesVersionId;
      if (previousId && effectiveDate) {
        const previous = await LegalVersionModel.findOne({ _id: previousId, companyCode, documentId: document._id });
        if (previous) {
          previous.effectiveTo = new Date(effectiveDate.getTime() - 1);
          previous.lifecycleStatus = "superseded";
          await previous.save();
          await LegalChunkModel.updateMany({ companyCode, documentId: document._id, versionId: previous._id }, { $set: { effectiveTo: previous.effectiveTo } });
        }
      }
      version.effectiveFrom = effectiveDate;
      version.effectiveTo = version.sourceExpiryDate || document.expiryDate;
      version.lifecycleStatus = "current";
      await version.save();
      document.currentVersionId = version._id as Types.ObjectId;
      document.status = version.sourceStatus || document.status;
      if (effectiveDate || version.sourceEffectiveDate) document.effectiveDate = effectiveDate || version.sourceEffectiveDate;
      if (version.sourceExpiryDate) document.expiryDate = version.sourceExpiryDate;
      await LegalChunkModel.updateMany({ companyCode, documentId: document._id, versionId: version._id }, { $set: {
        status: document.status,
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
      } });
    }
  } else {
    if (task.taskType !== "amendment") {
      version.lifecycleStatus = "superseded";
      await version.save();
    } else {
      const relationSymbols = new Set((task.details?.relatedDocuments as Array<{ symbol?: string }> | undefined || []).map((item) => String(item.symbol || "").trim().toLocaleLowerCase("vi-VN")));
      document.relatedDocuments = document.relatedDocuments.filter((relation) => !relationSymbols.has(relation.symbol.toLocaleLowerCase("vi-VN")));
    }
  }
  const pendingTasks = await LegalReviewTaskModel.countDocuments({ companyCode, documentId: document._id, status: "pending", _id: { $ne: task._id } });
  document.reviewRequired = pendingTasks > 0 || document.relatedDocuments.some((relation) => relation.reviewStatus !== "verified");
  await document.save();
  task.status = decision === "approve" ? "resolved" : "rejected";
  task.resolvedBy = userId;
  task.resolvedAt = new Date();
  await task.save();
  return { status: task.status };
}

export async function replaceLegalReviewText(companyCodeInput: string, userId: string, reviewId: string, text: string) {
  if (!Types.ObjectId.isValid(reviewId)) throw Object.assign(new Error("Mã yêu cầu rà soát không hợp lệ."), { status: 400 });
  const normalizedText = text.trim();
  if (!normalizedText || normalizedText.length > 500_000) throw Object.assign(new Error("Nội dung trích xuất phải có từ 1 đến 500.000 ký tự."), { status: 400 });
  const companyCode = companyCodeInput.trim().toUpperCase();
  const task = await LegalReviewTaskModel.findOne({ _id: reviewId, companyCode, status: "pending" });
  if (!task) throw Object.assign(new Error("Không tìm thấy yêu cầu đang chờ rà soát."), { status: 404 });
  const [version, document] = await Promise.all([
    LegalVersionModel.findOne({ _id: task.versionId, companyCode, documentId: task.documentId }),
    LegalDocumentModel.findOne({ _id: task.documentId, companyCode }),
  ]);
  if (!version || !document) throw Object.assign(new Error("Dữ liệu văn bản cần rà soát không còn đầy đủ."), { status: 409 });
  const structure = splitLegalStructure(normalizedText);
  if (!structure.length) throw Object.assign(new Error("Chưa nhận diện được cấu trúc Điều trong nội dung đã nhập."), { status: 422 });
  await LegalChunkModel.deleteMany({ companyCode, documentId: document._id, versionId: version._id });
  const count = await indexVersion({
    companyCode,
    documentId: document._id as Types.ObjectId,
    versionId: version._id as Types.ObjectId,
    text: normalizedText,
    effectiveFrom: version.effectiveFrom || document.effectiveDate,
    effectiveTo: version.effectiveTo,
    metadata: { issuingAuthority: document.issuingAuthority, field: document.field, status: document.status, sourceUrl: version.sourceUrl || document.sourceUrl },
  });
  version.extractedText = normalizedText;
  version.textHash = sha256(normalizedText);
  version.extractionStatus = "indexed";
  await version.save();
  task.reason = "Nội dung trích xuất đã được cập nhật; xác nhận vị trí Điều/Khoản trước khi đưa vào tra cứu.";
  task.details = { ...task.details, structuralChunks: count, correctedBy: userId };
  await task.save();
  return { chunksCount: count };
}
