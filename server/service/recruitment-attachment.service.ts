import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Express } from "express";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "../model/recruitment-attachment.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";
import { cloudinaryService } from "./cloudinary.service";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
const cleanName = (name: string) => name.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160);
export type RecruitmentAttachmentOwner = "job" | "applicant";

function validateFile(file: Express.Multer.File) {
  const originalName = cleanName(file.originalname);
  const extension = extname(originalName).toLowerCase();
  if (!ALLOWED.has(extension) || ALLOWED.get(extension) !== file.mimetype) throw new Error("Unsupported attachment");
  if (file.size > MAX_SIZE) throw new Error("Attachment is too large");
  return { originalName, extension };
}

async function validateOwner(scope: RecruitmentScope, ownerType: RecruitmentAttachmentOwner, ownerId: string) {
  const owner = ownerType === "job"
    ? await RecruitmentJobModel.findOne({ _id: ownerId, ...scope, isDeleted: false }).lean()
    : await RecruitmentApplicantModel.findOne({ _id: ownerId, ...scope, isDeleted: false }).lean();
  if (!owner) throw new Error(`${ownerType === "job" ? "Job" : "Applicant"} not found`);
}

export async function getOwnerAttachment(scope: RecruitmentScope, ownerType: RecruitmentAttachmentOwner, ownerId: string) {
  await validateOwner(scope, ownerType, ownerId);
  return RecruitmentAttachmentModel.findOne({ ...scope, ownerType, ownerId, isDeleted: false }).lean();
}

export async function uploadOwnerAttachment(
  scope: RecruitmentScope,
  actorId: string,
  ownerType: RecruitmentAttachmentOwner,
  ownerId: string,
  file: Express.Multer.File,
  version?: number,
) {
  const { originalName, extension } = validateFile(file);
  await validateOwner(scope, ownerType, ownerId);
  const existing: any = await RecruitmentAttachmentModel.findOne({ ...scope, ownerType, ownerId, isDeleted: false }).lean();
  const storageName = `${randomUUID()}${extension}`;
  const folder = `igen_erp/recruitment/${scope.companyCode.toLowerCase()}/${scope.branchId}/${ownerType}/${ownerId}`;
  const asset = await cloudinaryService.uploadPrivateRaw(file.buffer, folder, storageName);
  const metadata = { originalName, storageName, mimeType: file.mimetype, size: file.size, storageKey: asset.publicId, uploadedBy: actorId };
  if (!existing) {
    try { return await RecruitmentAttachmentModel.create({ ...scope, ownerType, ownerId, ...metadata }); }
    catch (error) { await cloudinaryService.deleteRawAsset(asset.publicId).catch(() => undefined); throw error; }
  }
  const expectedVersion = version ?? Number(existing.version || 0);
  const updated = await RecruitmentAttachmentModel.findOneAndUpdate(
    { _id: existing._id, ...scope, ownerType, ownerId, isDeleted: false, version: expectedVersion },
    { $set: metadata, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) {
    await cloudinaryService.deleteRawAsset(asset.publicId).catch(() => undefined);
    throw new Error("Attachment version conflict");
  }
  await cloudinaryService.deleteRawAsset(existing.storageKey).catch((error) => {
    console.warn("[recruitment-attachment] Old private asset cleanup failed:", (error as Error).message);
  });
  return updated;
}

export const uploadApplicantAttachment = (scope: RecruitmentScope, actorId: string, applicantId: string, file: Express.Multer.File, version?: number) =>
  uploadOwnerAttachment(scope, actorId, "applicant", applicantId, file, version);

export async function downloadApplicantAttachment(scope: RecruitmentScope, attachmentId: string) {
  const attachment: any = await RecruitmentAttachmentModel.findOne({ _id: attachmentId, ...scope, isDeleted: false }).lean();
  if (!attachment) throw new Error("Attachment not found");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return { signedUrl: cloudinaryService.createSignedRawUrl(attachment.storageKey, expiresAt), expiresAt, originalName: attachment.originalName, mimeType: attachment.mimeType };
}

export async function listApplicantAttachments(scope: RecruitmentScope, applicantId: string) {
  const attachment = await getOwnerAttachment(scope, "applicant", applicantId);
  return attachment ? [attachment] : [];
}

export async function deleteApplicantAttachment(scope: RecruitmentScope, attachmentId: string, actorId: string) {
  const attachment: any = await RecruitmentAttachmentModel.findOneAndUpdate(
    { _id: attachmentId, ...scope, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId }, $inc: { version: 1 } },
    { new: true },
  );
  if (!attachment) throw new Error("Attachment not found");
  await cloudinaryService.deleteRawAsset(attachment.storageKey);
  return attachment;
}
