import { ObjectId, type Db } from "mongodb";
import mongoose from "mongoose";
import { config } from "./config";
import { uploadCompanyFile } from "./cloudinary";
import { quotationContext } from "./context";
import { resourceIndexingService } from "../../service/resource-indexing.service";
import type { CompanyFile, SessionUser } from "./types";

export async function storeQuotationExport(db: Db, user: SessionUser, filename: string, mimeType: string, bytes: Buffer) {
  const context = quotationContext();
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw Object.assign(new Error("File đầu ra trống hoặc vượt quá 50 MB."), { statusCode: 422 });
  if (!config.cloudinaryConfigured) throw Object.assign(new Error("ERP chưa cấu hình kho file riêng tư Cloudinary để lưu tài liệu."), { statusCode: 409 });
  const uploaded = await uploadCompanyFile(bytes, filename, mimeType, user.companyId, config.cloudinary);
  const kind = context.exportKind || (/^\/contracts\//.test(context.command?.path || "") ? "contract" : /^\/acceptance-records\//.test(context.command?.path || "") ? "acceptance" : "estimate");
  const file: CompanyFile & Record<string, any> = { _id: new ObjectId(), companyId: user.companyId, uploadedBy: user.id, originalFilename: filename, mimeType, bytes: bytes.length,
    publicId: uploaded.publicId, assetId: uploaded.assetId, resourceType: uploaded.resourceType, createdAt: new Date(), kind,
    sourceId: context.exportSourceId, jobId: context.jobId };
  try {
    await db.collection<CompanyFile>("companyFiles").insertOne(file);
  } catch (error) {
    // Preserve enough information to clean up a completed upload whose metadata write failed.
    await mongoose.connection.db?.collection("quotation_storageOrphans").insertOne({ companyCode: context.companyCode, branchId: context.branchId, ...uploaded, createdAt: new Date() }).catch(() => undefined);
    throw error;
  }
  context.artifactId = String(file._id);
  const sourceType = kind === "contract" ? "quotation.contract" : kind === "acceptance" || kind === "settlement" ? "quotation.acceptance" : "quotation.document";
  try {
    await resourceIndexingService.registerUploadedResource({ companyCode: context.companyCode, branchId: context.branchId, sourceType,
      entityType: kind, entityId: context.exportSourceId || String(file._id), entityLabel: filename, sourceRecordId: context.exportSourceId || String(file._id), sourceField: "exports",
      sourceKey: `quotation:export:${file._id}`, fileName: filename, fileUrl: `/api/v1/quotation/files/${file._id}/download`, mimeType, size: bytes.length,
      storageProvider: "cloudinary", storageAccess: "authenticated", storagePublicId: uploaded.publicId, storageResourceType: uploaded.resourceType, uploaderId: context.actorId, uploaderName: context.actorName });
  } catch {
    await db.collection("companyFiles").updateOne({ _id: file._id }, { $set: { resourceIndexPending: true } });
  }
  return { _id: String(file._id), originalFilename: filename, mimeType, bytes: bytes.length, createdAt: file.createdAt };
}
