import { Router } from "express";
import Joi from "joi";
import { facebookPostController } from "../controller/facebook-post.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const facebookPostRouter = Router();

const publishSchema = {
  body: Joi.object({
    content: Joi.string().required().messages({
      "any.required": "Nội dung bài viết không được để trống.",
      "string.empty": "Nội dung bài viết không được để trống.",
    }),
    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "imageUrl phải là một đường dẫn URL hợp lệ.",
    }),
    videoUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "videoUrl phải là một đường dẫn URL hợp lệ.",
    }),
    pageId: Joi.string().required().messages({
      "any.required": "Page ID không được để trống.",
      "string.empty": "Page ID không được để trống.",
    }),
    accessToken: Joi.string().required().messages({
      "any.required": "Access Token không được để trống.",
      "string.empty": "Access Token không được để trống.",
    }),
  }),
};

const validateTokenSchema = {
  body: Joi.object({
    pageId: Joi.string().required(),
    accessToken: Joi.string().required(),
  }),
};

// Route đăng bài viết lên Facebook Page qua n8n (Yêu cầu đăng nhập và có quyền marketing:post)
facebookPostRouter.post(
  "/publish",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(publishSchema),
  facebookPostController.publish as any
);

// Route xác thực token liên kết Page Facebook qua n8n (Yêu cầu đăng nhập và có quyền marketing:post)
facebookPostRouter.post(
  "/validate-token",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(validateTokenSchema),
  facebookPostController.validateToken as any
);
