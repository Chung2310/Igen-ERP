import { Router } from "express";
import Joi from "joi";
import { HR_CREDENTIAL_TYPES } from "../../shared/hr-credential";
import { hrCredentialController } from "../controller/hr-credential.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { validateRequest } from "../middleware/validation";

export const hrCredentialRouter = Router();
const id = Joi.string().hex().length(24).required();
const optionalId = Joi.string().hex().length(24).optional();
const fileMetadata = {
  fileUrl: Joi.string().uri().allow("", null),
  fileName: Joi.string().trim().max(300).allow(""),
  fileMimeType: Joi.string().trim().max(200).allow(""),
  fileSize: Joi.number()
    .min(0)
    .max(10 * 1024 * 1024),
  resourceId: Joi.string().hex().length(24).allow("", null),
  uploadToken: Joi.string()
    .guid({ version: ["uuidv4"] })
    .allow("")
    .optional(),
};
const body = {
  employeeId: id,
  name: Joi.string().trim().min(2).max(300).required(),
  type: Joi.string()
    .valid(...HR_CREDENTIAL_TYPES)
    .required(),
  credentialNumber: Joi.string().trim().max(200).allow(""),
  issuingOrganization: Joi.string().trim().min(2).max(300).required(),
  issueDate: Joi.date().iso().required(),
  expiryDate: Joi.date().iso().allow(null, ""),
  professionalScope: Joi.string().trim().max(2000).allow(""),
  note: Joi.string().trim().max(2000).allow(""),
  reminderDays: Joi.number().integer().min(1).max(365).default(30),
  ...fileMetadata,
};
export const credentialUpdateBody = Joi.object({
  ...body,
  reminderDays: Joi.number().integer().min(1).max(365),
})
  .fork(["employeeId", "name", "type", "issuingOrganization", "issueDate"], (schema) => schema.optional())
  .min(1);

export const ALLOWED_CREDENTIAL_MIME_TYPES = [
  "application/pdf", "image/jpeg", "image/png", "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  "text/rtf",
  "text/markdown",
  "text/xml",
  "application/xml",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-tar",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/mp3",
  "audio/ogg",
] as const;

export const credentialUploadBody = Joi.object({
  file: Joi.string().required(),
  name: Joi.string().trim().max(300).required(),
  mimeType: Joi.string()
    .valid(...ALLOWED_CREDENTIAL_MIME_TYPES)
    .required(),
  size: Joi.number().min(1).max(10 * 1024 * 1024).required(),
});

hrCredentialRouter.use(requireAuth as any, requireModule("hr"));
hrCredentialRouter.post(
  "/upload",
  requirePermission(["credentials:manage", "hr:manage"]) as any,
  validateRequest({
    body: credentialUploadBody,
  }),
  hrCredentialController.upload as any,
);
hrCredentialRouter.get(
  "/",
  requirePermission(["credentials:read", "hr:read"]) as any,
  validateRequest({
    query: Joi.object({
      employeeId: optionalId,
      branchId: optionalId,
      companyCode: Joi.string().trim().optional(),
      search: Joi.string().trim().max(300).allow("").optional(),
      status: Joi.string().valid("active", "expiring", "expired").optional(),
      type: Joi.string()
        .valid(...HR_CREDENTIAL_TYPES)
        .optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
    }),
  }),
  hrCredentialController.list as any,
);
hrCredentialRouter.post(
  "/",
  requirePermission(["credentials:manage", "hr:manage"]) as any,
  validateRequest({ body: Joi.object(body) }),
  hrCredentialController.create as any,
);
hrCredentialRouter.patch(
  "/:id",
  requirePermission(["credentials:manage", "hr:manage"]) as any,
  validateRequest({
    params: Joi.object({ id }),
    body: credentialUpdateBody,
  }),
  hrCredentialController.update as any,
);
hrCredentialRouter.delete(
  "/:id",
  requirePermission(["credentials:manage", "hr:manage"]) as any,
  validateRequest({ params: Joi.object({ id }) }),
  hrCredentialController.remove as any,
);
