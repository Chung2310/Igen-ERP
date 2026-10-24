/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import Joi from "joi";
import { geminiController } from "../controller/gemini.controller.ts";
import { validateRequest } from "../../../../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const geminiRouter = Router();
const requireKnowledgeManager = requirePermission("company-knowledge:manage");

// Định nghĩa schemas xác thực dữ liệu Joi
const chatSchema = {
  body: Joi.object({
    message: Joi.string().required(),
    history: Joi.array()
      .items(
        Joi.object({
          sender: Joi.string().valid("user", "ai", "agent").required(),
          text: Joi.string().required(),
        })
      )
      .required(),
    aiConfig: Joi.object({
      enabled: Joi.boolean().required(),
      imageReplyEnabled: Joi.boolean().optional(),
      autoClassify: Joi.boolean().required(),
      autoCloseDeal: Joi.boolean().required(),
      autoFeedback: Joi.boolean().required(),
      replyDelay: Joi.number().required(),
      advancedInstructions: Joi.string().allow(""),
      customerServiceScript: Joi.string().allow("").optional(),
      customerServiceScriptFileName: Joi.string().allow("").optional(),
      trainingKnowledge: Joi.string().allow(""),
      model: Joi.string().allow("").optional(),
      autoFollowUpEnabled: Joi.boolean().optional(),
      followUpDelayHours: Joi.number().min(1).max(72).optional(),
      followUpPrompt: Joi.string().allow("").optional(),
    }).required(),
  }),
};

const pillarsSchema = {
  body: Joi.object({
    campaignTopic: Joi.string().required(),
    images: Joi.array().items(Joi.string()).optional(),
  }),
};

const swapPillarSchema = {
  body: Joi.object({
    campaignTopic: Joi.string().required(),
    currentPillars: Joi.array().items(Joi.any()).required(),
    pillarIdToReplace: Joi.string().required(),
    images: Joi.array().items(Joi.string()).optional(),
  }),
};

const ideasSchema = {
  body: Joi.object({
    campaignTopic: Joi.string().required(),
    selectedPillars: Joi.array().items(Joi.string()).required(),
    channels: Joi.array().items(Joi.string()).optional(),
    mediaType: Joi.string().valid("image", "video", "none").optional(),
    images: Joi.array().items(Joi.string()).optional(),
  }),
};

const scheduledCampaignSchema = {
  body: Joi.object({
    prompt: Joi.string().trim().min(3).required(),
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().required(),
    postsPerDay: Joi.number().integer().min(1).max(5).required(),
    postingTimes: Joi.array().items(Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(5).required(),
    channels: Joi.array().items(Joi.string().valid("Facebook", "TikTok")).min(1).required(),
  }),
};

const developSchema = {
  body: Joi.object({
    title: Joi.string().required(),
    summary: Joi.string().required(),
    suggestedContent: Joi.string().required(),
    channels: Joi.array().items(Joi.string()).required(),
    mediaType: Joi.string().valid("image", "video", "none").optional(),
    imageModel: Joi.string().optional().allow(""),
    imageResolution: Joi.string().optional().allow(""),
    imageAspectRatio: Joi.string().optional().allow(""),
    mediaPrompt: Joi.string().optional().allow(""),
  }),
};

const generateImageSchema = {
  body: Joi.object({
    prompt: Joi.string().trim().min(1).max(20_000).required(),
    aspectRatio: Joi.string().optional(),
    modelName: Joi.string().valid(
      "gemini-banana-flash",
      "gemini-banana-pro",
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image"
    ).optional(),
    resolution: Joi.string().optional(),
    negativePrompt: Joi.string().optional().allow(""),
    existingImageUris: Joi.array().items(Joi.string().max(2_000_000)).max(3).optional(),
  }),
};

const normalizedImageRegionSchema = Joi.object({
  x: Joi.number().min(0).max(1).required(),
  y: Joi.number().min(0).max(1).required(),
  width: Joi.number().greater(0).max(1).required(),
  height: Joi.number().greater(0).max(1).required(),
}).custom((value, helpers) => {
  if (value.x + value.width > 1 || value.y + value.height > 1) {
    return helpers.error("any.invalid");
  }
  return value;
}).messages({ "any.invalid": "Vùng chọn phải nằm hoàn toàn trong ảnh." });

const editImageSchema = {
  body: Joi.object({
    sourceImageUrl: Joi.string().max(2_000_000).required(),
    sourceMediaId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().messages({
      "string.pattern.base": "Mã ảnh nguồn phải là định dạng MongoDB ObjectId hợp lệ.",
    }),
    annotationImageUrl: Joi.string().max(2_000_000).optional(),
    requestId: Joi.string().trim().max(100).optional(),
    instruction: Joi.string().trim().min(2).max(4_000).required(),
    regionNote: Joi.string().trim().max(2_000).allow("").optional(),
    region: normalizedImageRegionSchema.optional(),
    crop: normalizedImageRegionSchema.optional(),
    strokes: Joi.array().items(
      Joi.object({
        color: Joi.string().max(32).optional(),
        width: Joi.number().min(0).max(1).optional(),
        points: Joi.array().items(
          Joi.object({ x: Joi.number().min(0).max(1).required(), y: Joi.number().min(0).max(1).required() })
        ).min(1).max(500).required(),
      })
    ).max(20).optional(),
    supportingImageUris: Joi.array().items(Joi.string().max(2_000_000)).max(2).optional(),
    aspectRatio: Joi.string().optional(),
    modelName: Joi.string().valid(
      "gemini-banana-flash",
      "gemini-banana-pro",
      "google/gemini-3.1-flash-image",
      "google/gemini-3-pro-image"
    ).optional(),
    resolution: Joi.string().optional(),
    preserveOutsideRegion: Joi.boolean().default(true),
  }),
};


const optimizeScriptSchema = {
  body: Joi.object({
    text: Joi.string().required(),
    readingStyle: Joi.string().allow("").optional(),
    model: Joi.string().allow("").optional(),
  }),
};

const optimizePromptSchema = {
  body: Joi.object({
    description: Joi.string().trim().min(1).max(30_000).required(),
    imageUris: Joi.array().items(Joi.string().max(2_000_000)).max(3).optional(),
    modelName: Joi.string().max(100).optional(),
  }),
};


const getHistorySchema = {
  query: Joi.object({
    type: Joi.string().valid("image", "video", "voice").required(),
  }),
};

const deleteHistorySchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "string.pattern.base": "Mã ID lịch sử phải là định dạng MongoDB ObjectId hợp lệ."
    }),
  }),
};

const uploadDocumentSchema = {
  body: Joi.object({
    fileName: Joi.string().required(),
    fileBase64: Joi.string().required(),
    mimeType: Joi.string().required(),
    extractOnly: Joi.boolean().optional(),
    documentType: Joi.string().valid(
      "company_profile", "product", "service", "policy", "pricing", "promotion", "faq", "brand_guideline", "scenario", "general"
    ).optional(),
    channelScope: Joi.array()
      .items(Joi.string().valid("facebook", "zalo", "tiktok", "all"))
      .min(1)
      .optional(),
    purposeScope: Joi.array()
      .items(
        Joi.string().valid(
          "sales",
          "support",
          "marketing",
          "caption",
          "all"
        )
      )
      .min(1)
      .optional(),
  }),
};

const extractScenarioSchema = {
  body: uploadDocumentSchema.body.keys({
    extractOnly: Joi.boolean().valid(true).default(true),
    documentType: Joi.string().valid("scenario").default("scenario"),
  }),
};

const syncDriveSchema = {
  body: Joi.object({
    docLink: Joi.string().required(),
    channelScope: Joi.array()
      .items(Joi.string().valid("facebook", "zalo", "tiktok", "all"))
      .min(1)
      .optional(),
    purposeScope: Joi.array()
      .items(
        Joi.string().valid(
          "sales",
          "support",
          "marketing",
          "caption",
          "all"
        )
      )
      .min(1)
      .optional(),
  }),
};

const testReplySchema = {
  body: Joi.object({
    message: Joi.string().allow("").default(""),
    images: Joi.array().items(Joi.string().max(11_184_850)
      .pattern(/^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/)).max(3).optional(),
    aiConfig: Joi.object().optional(),
    channel: Joi.string().valid("facebook", "zalo", "tiktok").optional(),
    conversationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    platformId: Joi.string().max(200).optional(),
  }).custom((value, helpers) => value.message.trim() || value.images?.length
    ? value : helpers.message({ custom: "Vui lòng nhập câu hỏi hoặc chọn ảnh để kiểm định AI." })),
};

const feedbackSchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  }),
  body: Joi.object({
    feedback: Joi.string().valid("good", "bad", "needs_fix").required(),
    note: Joi.string().optional().allow(""),
  }),
};

// Đăng ký định tuyến API kèm Joi validation
geminiRouter.post("/chat", requireAuth as any, validateRequest(chatSchema), geminiController.chat as any);
geminiRouter.get("/marketing-suggestions", requireAuth as any, geminiController.getMarketingSuggestions as any);
geminiRouter.post("/marketing-pillars", requireAuth as any, validateRequest(pillarsSchema), geminiController.analyzeMarketingPillars as any);
geminiRouter.post("/marketing-pillars/swap", requireAuth as any, validateRequest(swapPillarSchema), geminiController.swapMarketingPillar as any);
geminiRouter.post("/marketing-ideas", requireAuth as any, validateRequest(ideasSchema), geminiController.generateMarketingIdeas as any);
geminiRouter.post("/scheduled-campaign", requireAuth as any, validateRequest(scheduledCampaignSchema), geminiController.generateScheduledCampaign as any);
geminiRouter.post("/marketing-develop", requireAuth as any, validateRequest(developSchema), geminiController.developMarketingIdea as any);

// Knowledge management / auto reply endpoints
geminiRouter.get("/knowledge-health", requireAuth as any, geminiController.getKnowledgeHealth as any);
geminiRouter.post("/clear-knowledge", requireAuth as any, requireKnowledgeManager as any, geminiController.clearKnowledge as any);
geminiRouter.delete("/customer-service-scenario", requireAuth as any, requireKnowledgeManager as any, geminiController.clearCustomerServiceScenario as any);
geminiRouter.post("/test-reply", requireAuth as any, validateRequest(testReplySchema), geminiController.testReply as any);
geminiRouter.get("/ai-reply-logs", requireAuth as any, geminiController.listAIReplyLogs as any);
geminiRouter.patch("/ai-reply-logs/:id/feedback", requireAuth as any, validateRequest(feedbackSchema), geminiController.updateAIReplyFeedback as any);
geminiRouter.post("/sync-drive", requireAuth as any, requireKnowledgeManager as any, validateRequest(syncDriveSchema), geminiController.syncGoogleDrive as any);
geminiRouter.post("/upload-document", requireAuth as any, requireKnowledgeManager as any, validateRequest(uploadDocumentSchema), geminiController.uploadLocalDocument as any);
geminiRouter.post("/extract-scenario", requireAuth as any, requirePermission("omni-inbox:manage") as any, validateRequest(extractScenarioSchema), (req, _res, next) => {
  req.body.extractOnly = true;
  req.body.documentType = "scenario";
  next();
}, geminiController.uploadLocalDocument as any);

// Media của Campaign (requireAuth bảo vệ tài khoản lưu lịch sử)
geminiRouter.post("/generate-image", requireAuth as any, validateRequest(generateImageSchema), geminiController.generateImage);
geminiRouter.post("/edit-image", requireAuth as any, validateRequest(editImageSchema), geminiController.editImage);
geminiRouter.post("/optimize-script", requireAuth as any, validateRequest(optimizeScriptSchema), geminiController.optimizeScript);
geminiRouter.post("/optimize-prompt", requireAuth as any, validateRequest(optimizePromptSchema), geminiController.optimizeImagePrompt);

geminiRouter.get("/media-history", requireAuth as any, validateRequest(getHistorySchema), geminiController.getMediaHistory);
geminiRouter.delete("/media-history/:id", requireAuth as any, validateRequest(deleteHistorySchema), geminiController.deleteMediaHistory);

