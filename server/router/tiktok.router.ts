import { Router } from "express";
import Joi from "joi";
import { tiktokController } from "../controller/tiktok.controller";
import { validateRequest } from "../middleware/validation";

export const tiktokRouter = Router();

const publishSchema = {
  body: Joi.object({
    cardId: Joi.string().required().messages({
      "any.required": "Card ID không được để trống.",
      "string.empty": "Card ID không được để trống.",
    }),
    caption: Joi.string().optional().allow(""),
    videoUrl: Joi.string().uri().required().messages({
      "any.required": "Video URL không được để trống.",
      "string.empty": "Video URL không được để trống.",
      "string.uri": "Video URL phải là một đường dẫn URL hợp lệ.",
    }),
    privacyLevel: Joi.string()
      .valid("PUBLIC", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_ACTIVE_USER", "SELF_ONLY")
      .optional()
      .default("SELF_ONLY")
      .messages({
        "any.only": "Quyền riêng tư không hợp lệ.",
      }),
  }),
};

// Route đăng bài viết lên TikTok (MOCK)
tiktokRouter.post(
  "/publish",
  validateRequest(publishSchema),
  tiktokController.publish
);

const validateTokenSchema = {
  body: Joi.object({
    username: Joi.string().required().messages({
      "any.required": "Username không được để trống.",
      "string.empty": "Username không được để trống.",
    }),
    accessToken: Joi.string().required().messages({
      "any.required": "Access Token không được để trống.",
      "string.empty": "Access Token không được để trống.",
    }),
  }),
};

// Route xác thực token liên kết TikTok qua n8n
tiktokRouter.post(
  "/validate-token",
  validateRequest(validateTokenSchema),
  tiktokController.validateToken
);

