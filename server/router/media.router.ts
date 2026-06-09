import { Router } from "express";
import Joi from "joi";
import { mediaController } from "../controller/media.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

export const mediaRouter = Router();

const uploadSchema = {
  body: Joi.object({
    file: Joi.string().required().messages({
      "any.required": "Trường 'file' là bắt buộc và không thể thiếu.",
      "string.empty": "Nội dung 'file' không được để trống.",
    }),
    folder: Joi.string().optional().allow("").messages({
      "string.base": "Trường 'folder' phải là kiểu văn bản (string).",
    }),
  }),
};

// Route tải lên đa phương tiện tới Cloudinary qua Backend Relay (Yêu cầu đăng nhập)
mediaRouter.post(
  "/upload",
  requireAuth as any,
  validateRequest(uploadSchema),
  mediaController.upload as any
);
