import { Router } from "express";
import Joi from "joi";
import { resourceController } from "../controller/resource.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

export const resourceRouter = Router();

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);

const listSchema = {
  query: Joi.object({
    section: Joi.string().valid("local", "drive").optional(),
    parentId: Joi.string().allow("", "root").optional(),
  }).unknown(true),
};

const folderSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(200).required().messages({
      "any.required": "Tên thư mục là bắt buộc.",
      "string.empty": "Tên thư mục không được để trống.",
    }),
    parentId: Joi.string().allow(null, "", "root").optional(),
    section: Joi.string().valid("local", "drive").optional(),
    roomId: Joi.string().allow(null, "").optional(),
  }),
};

const fileSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
    fileUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).required().messages({
      "any.required": "Đường dẫn file là bắt buộc.",
      "string.uri": "Đường dẫn file phải là URL hợp lệ.",
    }),
    parentId: Joi.string().allow(null, "", "root").optional(),
    mimeType: Joi.string().allow("").optional(),
    size: Joi.number().min(0).optional(),
    roomId: Joi.string().allow(null, "").optional(),
  }),
};

const driveSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(300).required(),
    driveLink: Joi.string().trim().uri({ scheme: ["http", "https"] }).required().messages({
      "any.required": "Link Google Drive là bắt buộc.",
      "string.uri": "Link Google Drive phải là URL hợp lệ.",
    }),
    driveType: Joi.string()
      .valid("folder", "document", "spreadsheet", "presentation", "pdf", "file")
      .optional(),
  }),
};

const driveUploadSchema = {
  body: Joi.object({
    file: Joi.string().required().messages({ "any.required": "Thiếu dữ liệu file." }),
    name: Joi.string().trim().min(1).max(300).required(),
    mimeType: Joi.string().allow("").optional(),
  }),
};

const renameSchema = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({ name: Joi.string().trim().min(1).max(300).required() }),
};

const moveSchema = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    parentId: Joi.string().allow(null, "", "root").required().messages({
      "any.required": "Mã thư mục đích là bắt buộc.",
    }),
  }),
};

const idParamSchema = {
  params: Joi.object({ id: objectId.required() }),
};

const sharesSchema = {
  body: Joi.array().items(
    Joi.object({
      targetId: Joi.string().required(),
      targetType: Joi.string().valid("user", "room").required(),
      targetName: Joi.string().allow("").optional(),
    })
  ).required(),
};

// Google Drive dùng chung — đặt trước các route "/:id" để tránh trùng khớp
resourceRouter.get("/drive/files", requireAuth as any, resourceController.driveList as any);
resourceRouter.post("/drive/upload", requireAuth as any, validateRequest(driveUploadSchema), resourceController.driveUpload as any);
resourceRouter.delete("/drive/files/:fileId", requireAuth as any, resourceController.driveDelete as any);

resourceRouter.get("/", requireAuth as any, validateRequest(listSchema), resourceController.list as any);
resourceRouter.get("/trash", requireAuth as any, resourceController.trashList as any);
resourceRouter.get("/breadcrumb/:id", requireAuth as any, resourceController.breadcrumb as any);
resourceRouter.get("/:id", requireAuth as any, validateRequest(idParamSchema), resourceController.getDetail as any);
resourceRouter.post("/folder", requireAuth as any, validateRequest(folderSchema), resourceController.createFolder as any);
resourceRouter.post("/file", requireAuth as any, validateRequest(fileSchema), resourceController.createFile as any);
resourceRouter.post("/drive", requireAuth as any, validateRequest(driveSchema), resourceController.addDriveLink as any);
resourceRouter.get("/:id/shares", requireAuth as any, validateRequest(idParamSchema), resourceController.getShares as any);
resourceRouter.put("/:id/shares", requireAuth as any, validateRequest(idParamSchema), validateRequest(sharesSchema), resourceController.updateShares as any);
resourceRouter.patch("/:id/rename", requireAuth as any, validateRequest(renameSchema), resourceController.rename as any);
resourceRouter.patch("/:id/move", requireAuth as any, validateRequest(moveSchema), resourceController.move as any);
resourceRouter.post("/:id/restore", requireAuth as any, validateRequest(idParamSchema), resourceController.restore as any);
resourceRouter.delete("/:id", requireAuth as any, validateRequest(idParamSchema), resourceController.remove as any);
resourceRouter.get("/:id/download-zip", requireAuth as any, resourceController.downloadZip as any);

