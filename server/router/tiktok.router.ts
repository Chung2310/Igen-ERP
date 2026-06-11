import { Router } from "express";
import Joi from "joi";
import { tiktokController } from "../controller/tiktok.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const tiktokRouter = Router();

// ─── Schema: Đăng bài ─────────────────────────────────────────────────────────
const publishSchema = {
  body: Joi.object({
    cardId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "any.required": "Card ID không được để trống.",
        "string.empty": "Card ID không được để trống.",
        "string.pattern.base": "Card ID phải là định dạng MongoDB ObjectId hợp lệ.",
      }),
    caption: Joi.string().optional().allow(""),
    videoUrl: Joi.string().uri().required().messages({
      "any.required": "Video URL không được để trống.",
      "string.empty": "Video URL không được để trống.",
      "string.uri": "Video URL phải là một đường dẫn URL hợp lệ.",
    }),
    privacyLevel: Joi.string()
      .valid("PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_ACTIVE_USER", "SELF_ONLY")
      .optional()
      .default("SELF_ONLY")
      .messages({
        "any.only":
          "Quyền riêng tư không hợp lệ. Các giá trị hợp lệ: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_ACTIVE_USER, SELF_ONLY.",
      }),
    accessToken: Joi.string().optional().allow("").messages({
      "string.empty": "Access Token TikTok không được để trống.",
    }),
    username: Joi.string().optional().allow(""),
    scheduledTime: Joi.string()
      .isoDate()
      .optional()
      .allow("")
      .messages({
        "string.isoDate": "Thời gian lên lịch đăng bài phải đúng định dạng ISO date.",
      }),
    blotatoAccountId: Joi.string().optional().allow(""),
    blotatoApiKey: Joi.string().optional().allow(""),
    integrationId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow("")
      .messages({
        "string.pattern.base": "Mã ID tài khoản kết nối (integrationId) phải là định dạng MongoDB ObjectId hợp lệ.",
      }),
  }),
};

// ─── Schema: Xác thực token ───────────────────────────────────────────────────
const validateTokenSchema = {
  body: Joi.object({
    username: Joi.string().optional().allow("").messages({
      "string.empty": "Username không được để trống.",
    }),
    accessToken: Joi.string().optional().allow("").messages({
      "string.empty": "Access Token không được để trống.",
    }),
    blotatoApiKey: Joi.string().optional().allow(""),
  }),
};

// ─── Schema: Lấy creator info ─────────────────────────────────────────────────
const creatorInfoSchema = {
  body: Joi.object({
    accessToken: Joi.string().required().messages({
      "any.required": "Access Token không được để trống.",
      "string.empty": "Access Token không được để trống.",
    }),
  }),
};

// ─── Schema: Lấy danh sách tài khoản Blotato ──────────────────────────────────
const blotatoAccountsSchema = {
  query: Joi.object({
    blotatoApiKey: Joi.string().optional().allow(""),
  }).optional(),
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/tiktok/publish
 * Đăng video lên TikTok (Yêu cầu đăng nhập và có quyền marketing:post)
 */
tiktokRouter.post(
  "/publish",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(publishSchema),
  tiktokController.publish as any
);

/**
 * POST /api/v1/tiktok/validate-token
 * Xác thực Access Token TikTok (Yêu cầu đăng nhập và có quyền marketing:post)
 */
tiktokRouter.post(
  "/validate-token",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(validateTokenSchema),
  tiktokController.validateToken as any
);

/**
 * POST /api/v1/tiktok/creator-info
 * Lấy thông tin creator TikTok và privacy options (Yêu cầu đăng nhập)
 */
tiktokRouter.post(
  "/creator-info",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(creatorInfoSchema),
  tiktokController.getCreatorInfo as any
);

/**
 * GET /api/v1/tiktok/blotato-accounts
 * Lấy danh sách tài khoản TikTok từ Blotato (Yêu cầu đăng nhập)
 */
tiktokRouter.get(
  "/blotato-accounts",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(blotatoAccountsSchema),
  tiktokController.getBlotatoAccounts as any
);

