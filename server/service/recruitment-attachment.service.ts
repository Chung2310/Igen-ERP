import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Express } from "express";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "../model/recruitment-attachment.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";
import { cloudinaryService } from "./cloudinary.service";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Map([
  [".pdf", "application/pdf"],
  [".doc", "application/msword"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
]);
const cleanName = (name: string) => name.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160);

export async function uploadApplicantAttachment(scope: RecruitmentScope, actorId: string, applicantId: string, file: Express.Multer.File) {
  const originalName = cleanName(file.originalname);
  const extension = extname(originalName).toLowerCase();
  if (!ALLOWED.has(extension) || ALLOWED.get(extension) !== file.mimetype) throw new Error("Unsupported attachment");
  if (file.size > MAX_SIZE) throw new Error("Attachment is too large");
  const applicant = await RecruitmentApplicantModel.findOne({ _id: applicantId, ...scope, isDeleted: false }).lean();
  if (!applicant) throw new Error("Applicant not found");
  const storageName = `${randomUUID()}${extension}`;
  const folder = `igen_erp/recruitment/${scope.companyCode.toLowerCase()}/${scope.branchId}/${applicantId}`;
  const asset = await cloudinaryService.uploadPrivateRaw(file.buffer, folder, storageName);
  return RecruitmentAttachmentModel.create({
    ...scope, applicantId, originalName, storageName, mimeType: file.mimetype,
    size: file.size, storageKey: asset.publicId, uploadedBy: actorId,
  });
}

export async function downloadApplicantAttachment(scope: RecruitmentScope, attachmentId: string) {
  const attachment: any = await RecruitmentAttachmentModel.findOne({ _id: attachmentId, ...scope, isDeleted: false }).lean();
  if (!attachment) throw new Error("Attachment not found");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return { signedUrl: cloudinaryService.createSignedRawUrl(attachment.storageKey, expiresAt), expiresAt, originalName: attachment.originalName, mimeType: attachment.mimeType };
}

export function listApplicantAttachments(scope: RecruitmentScope, applicantId: string) {
  return RecruitmentAttachmentModel.find({ ...scope, applicantId, isDeleted: false })
    .select("originalName mimeType size createdAt")
    .sort({ createdAt: -1 })
    .lean();
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
