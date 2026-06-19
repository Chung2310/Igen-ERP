import { Router } from "express";
import Joi from "joi";
import { tiktokController } from "../controller/tiktok.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const tiktokRouter = Router();
tiktokRouter.post("/webhook", tiktokController.receiveWebhook as any);

// â”€â”€â”€ Schema: ÄÄƒng bÃ i â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const publishSchema = {
  body: Joi.object({
    cardId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "any.required": "Card ID khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
        "string.empty": "Card ID khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
        "string.pattern.base": "Card ID pháº£i lÃ  Ä‘á»‹nh dáº¡ng MongoDB ObjectId há»£p lá»‡.",
      }),
    caption: Joi.string().optional().allow(""),
    videoUrl: Joi.string().uri().required().messages({
      "any.required": "Video URL khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
      "string.empty": "Video URL khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
      "string.uri": "Video URL pháº£i lÃ  má»™t Ä‘Æ°á»ng dáº«n URL há»£p lá»‡.",
    }),
    privacyLevel: Joi.string()
      .valid("PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_ACTIVE_USER", "SELF_ONLY")
      .optional()
      .default("SELF_ONLY")
      .messages({
        "any.only":
          "Quyá»n riÃªng tÆ° khÃ´ng há»£p lá»‡. CÃ¡c giÃ¡ trá»‹ há»£p lá»‡: PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_ACTIVE_USER, SELF_ONLY.",
      }),
    accessToken: Joi.string().optional().allow("").messages({
      "string.empty": "Access Token TikTok khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
    }),
    username: Joi.string().optional().allow(""),
    scheduledTime: Joi.string()
      .isoDate()
      .optional()
      .allow("")
      .messages({
        "string.isoDate": "Thá»i gian lÃªn lá»‹ch Ä‘Äƒng bÃ i pháº£i Ä‘Ãºng Ä‘á»‹nh dáº¡ng ISO date.",
      }),
    blotatoAccountId: Joi.string().optional().allow(""),
    blotatoApiKey: Joi.string().optional().allow(""),
    integrationId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow("")
      .messages({
        "string.pattern.base": "MÃ£ ID tÃ i khoáº£n káº¿t ná»‘i (integrationId) pháº£i lÃ  Ä‘á»‹nh dáº¡ng MongoDB ObjectId há»£p lá»‡.",
      }),
  }),
};

// â”€â”€â”€ Schema: XÃ¡c thá»±c token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const validateTokenSchema = {
  body: Joi.object({
    username: Joi.string().optional().allow("").messages({
      "string.empty": "Username khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
    }),
    accessToken: Joi.string().optional().allow("").messages({
      "string.empty": "Access Token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
    }),
    blotatoApiKey: Joi.string().optional().allow(""),
  }),
};

// â”€â”€â”€ Schema: Láº¥y creator info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const creatorInfoSchema = {
  body: Joi.object({
    accessToken: Joi.string().required().messages({
      "any.required": "Access Token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
      "string.empty": "Access Token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
    }),
  }),
};

// â”€â”€â”€ Schema: Láº¥y danh sÃ¡ch tÃ i khoáº£n Blotato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const blotatoAccountsSchema = {
  query: Joi.object({
    blotatoApiKey: Joi.string().optional().allow(""),
  }).optional(),
};

// â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * POST /api/v1/tiktok/publish
 * ÄÄƒng video lÃªn TikTok (YÃªu cáº§u Ä‘Äƒng nháº­p vÃ  cÃ³ quyá»n marketing:post)
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
 * XÃ¡c thá»±c Access Token TikTok (YÃªu cáº§u Ä‘Äƒng nháº­p vÃ  cÃ³ quyá»n marketing:post)
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
 * Láº¥y thÃ´ng tin creator TikTok vÃ  privacy options (YÃªu cáº§u Ä‘Äƒng nháº­p)
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
 * Láº¥y danh sÃ¡ch tÃ i khoáº£n TikTok tá»« Blotato (YÃªu cáº§u Ä‘Äƒng nháº­p)
 */
tiktokRouter.get(
  "/blotato-accounts",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(blotatoAccountsSchema),
  tiktokController.getBlotatoAccounts as any
);

