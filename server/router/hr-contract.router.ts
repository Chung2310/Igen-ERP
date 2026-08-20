import { Router } from "express";
import Joi from "joi";
import { hrContractController } from "../controller/hr-contract.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { validateRequest } from "../middleware/validation";

export const hrContractRouter = Router();
const id = Joi.string().hex().length(24).required();
const optionalId = Joi.string().hex().length(24).optional();
const url = Joi.string().uri().allow("", null);

const listQuerySchema = Joi.object({
  employeeId: optionalId.messages({
    "string.hex": "Định dạng ID nhân viên không hợp lệ.",
    "string.length": "Định dạng ID nhân viên không hợp lệ.",
  }),
  branchId: optionalId.messages({
    "string.hex": "Định dạng ID chi nhánh không hợp lệ.",
    "string.length": "Định dạng ID chi nhánh không hợp lệ.",
  }),
  companyCode: Joi.string().trim().optional(),
  search: Joi.string().trim().allow("").optional(),
  page: Joi.number().integer().min(1).default(1).optional().messages({
    "number.base": "Trang phải là số.",
    "number.min": "Trang tối thiểu là 1.",
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).optional().messages({
    "number.base": "Giới hạn số bản ghi phải là số.",
    "number.min": "Giới hạn số bản ghi tối thiểu là 1.",
    "number.max": "Giới hạn số bản ghi tối đa là 100.",
  }),
});
const fileMetadata = {
  contractFileName: Joi.string().allow("").max(300),
  contractFileMimeType: Joi.string().allow("").max(200),
  contractFileSize: Joi.number().min(0),
  contractResourceId: Joi.string().hex().length(24).allow("", null),
  signedImageName: Joi.string().allow("").max(300),
  signedImageMimeType: Joi.string().allow("").max(200),
  signedImageSize: Joi.number().min(0),
  signedImageResourceId: Joi.string().hex().length(24).allow("", null),
  contractFileUploadToken: Joi.string().guid({ version: ["uuidv4"] }).allow("").optional(),
  signedImageUploadToken: Joi.string().guid({ version: ["uuidv4"] }).allow("").optional(),
};
const contractBody = Joi.object({
  contractType: Joi.string().trim().max(100).required(),
  employeeId: id,
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).required(),
  status: Joi.string()
    .valid("draft", "active", "expired", "terminated")
    .required(),
  contractFileUrl: url,
  signedImageUrl: url,
  ...fileMetadata,
  note: Joi.string().allow("").max(1000),
});
const updateBody = Joi.object({
  contractType: Joi.string().trim().max(100),
  employeeId: Joi.string().hex().length(24),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  status: Joi.string().valid("draft", "active", "expired", "terminated"),
  contractFileUrl: url,
  signedImageUrl: url,
  ...fileMetadata,
  note: Joi.string().allow("").max(1000),
}).min(1);
const extensionBody = Joi.object({
  newEndDate: Joi.date().iso().required(),
  extensionDate: Joi.date().iso().required(),
  reason: Joi.string().allow("").max(1000),
  extensionFileUrl: url,
  extensionFileName: Joi.string().allow("").max(300),
  extensionFileMimeType: Joi.string().allow("").max(200),
  extensionFileSize: Joi.number().min(0),
  extensionResourceId: Joi.string().hex().length(24).allow("", null),
  signedImageUrl: url,
  signedImageName: Joi.string().allow("").max(300),
  signedImageMimeType: Joi.string().allow("").max(200),
  signedImageSize: Joi.number().min(0),
  signedImageResourceId: Joi.string().hex().length(24).allow("", null),
  extensionFileUploadToken: Joi.string().guid({ version: ["uuidv4"] }).allow("").optional(),
  extensionSignedImageUploadToken: Joi.string().guid({ version: ["uuidv4"] }).allow("").optional(),
});

hrContractRouter.use(requireAuth as any, requireModule("hr"));
hrContractRouter.post(
  "/upload",
  requirePermission("hr:manage") as any,
  validateRequest({
    body: Joi.object({
      file: Joi.string().required(),
      name: Joi.string().trim().max(300).required(),
      mimeType: Joi.string().max(200).allow(""),
      size: Joi.number()
        .min(0)
        .max(10 * 1024 * 1024)
        .required(),
      kind: Joi.string()
        .valid("contract", "signed", "extension", "extensionSigned")
        .required(),
    }),
  }),
  hrContractController.uploadResource as any,
);
hrContractRouter.get(
  "/",
  requirePermission("hr:read") as any,
  validateRequest({ query: listQuerySchema }),
  hrContractController.list as any,
);
hrContractRouter.post(
  "/",
  requirePermission("hr:manage") as any,
  validateRequest({ body: contractBody }),
  hrContractController.create as any,
);
hrContractRouter.patch(
  "/:id",
  requirePermission("hr:manage") as any,
  validateRequest({ params: Joi.object({ id }), body: updateBody }),
  hrContractController.update as any,
);
hrContractRouter.get(
  "/extensions/list",
  requirePermission("hr:read") as any,
  hrContractController.listExtensions as any,
);
hrContractRouter.post(
  "/:id/extensions",
  requirePermission("hr:manage") as any,
  validateRequest({ params: Joi.object({ id }), body: extensionBody }),
  hrContractController.extend as any,
);
