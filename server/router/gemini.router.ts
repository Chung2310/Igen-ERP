import { Router } from "express";
import Joi from "joi";
import { geminiController } from "../controller/gemini.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

export const geminiRouter = Router();

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
      autoClassify: Joi.boolean().required(),
      autoCloseDeal: Joi.boolean().required(),
      autoFeedback: Joi.boolean().required(),
      replyDelay: Joi.number().required(),
      advancedInstructions: Joi.string().allow(""),
      trainingKnowledge: Joi.string().allow(""),
    }).required(),
  }),
};

const pillarsSchema = {
  body: Joi.object({
    campaignTopic: Joi.string().required(),
  }),
};

const ideasSchema = {
  body: Joi.object({
    campaignTopic: Joi.string().required(),
    selectedPillars: Joi.array().items(Joi.string()).required(),
    channels: Joi.array().items(Joi.string()).optional(),
    mediaType: Joi.string().valid("image", "video", "none").optional(),
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
    videoModel: Joi.string().optional().allow(""),
    videoQuality: Joi.string().optional().allow(""),
    videoDuration: Joi.string().optional().allow(""),
    videoAspectRatio: Joi.string().optional().allow(""),
  }),
};

const generateImageSchema = {
  body: Joi.object({
    prompt: Joi.string().required(),
    aspectRatio: Joi.string().optional(),
    modelName: Joi.string().optional(),
    resolution: Joi.string().optional(),
    existingImageUris: Joi.array().items(Joi.string()).optional(),
  }),
};

const generateVideoSchema = {
  body: Joi.object({
    prompt: Joi.string().required(),
    durationSeconds: Joi.number().optional(),
    aspectRatio: Joi.string().optional(),
    modelName: Joi.string().optional(),
    resolution: Joi.string().optional(),
    referenceVideoUri: Joi.string().allow("").optional(),
    referenceImageUris: Joi.array().items(Joi.string()).optional(),
  }),
};

const generateVoiceSchema = {
  body: Joi.object({
    textToSpeak: Joi.string().required(),
    styleInstructions: Joi.string().allow("").optional(),
    mode: Joi.string().valid("single", "multi").optional(),
    temperature: Joi.number().optional(),
    modelName: Joi.string().optional(),
    voiceName: Joi.string().optional(),
    speakerA: Joi.string().optional(),
    speakerB: Joi.string().optional(),
  }),
};

const optimizeScriptSchema = {
  body: Joi.object({
    text: Joi.string().required(),
    readingStyle: Joi.string().allow("").optional(),
  }),
};

const optimizePromptSchema = {
  body: Joi.object({
    description: Joi.string().required(),
    imageUris: Joi.array().items(Joi.string()).optional(),
  }),
};

const optimizeVideoPromptSchema = {
  body: Joi.object({
    description: Joi.string().required(),
    imageUris: Joi.array().items(Joi.string()).optional(),
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

const syncDriveSchema = {
  body: Joi.object({
    docLink: Joi.string().required(),
  }),
};

const testReplySchema = {
  body: Joi.object({
    message: Joi.string().required(),
    aiConfig: Joi.object().optional(),
  }),
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
geminiRouter.post("/chat", validateRequest(chatSchema), geminiController.chat);
geminiRouter.get("/marketing-suggestions", geminiController.getMarketingSuggestions);
geminiRouter.post("/marketing-pillars", validateRequest(pillarsSchema), geminiController.analyzeMarketingPillars);
geminiRouter.post("/marketing-ideas", validateRequest(ideasSchema), geminiController.generateMarketingIdeas);
geminiRouter.post("/marketing-develop", validateRequest(developSchema), geminiController.developMarketingIdea);

// Knowledge management / auto reply endpoints
geminiRouter.get("/knowledge-health", requireAuth as any, geminiController.getKnowledgeHealth as any);
geminiRouter.post("/test-reply", requireAuth as any, validateRequest(testReplySchema), geminiController.testReply as any);
geminiRouter.get("/ai-reply-logs", requireAuth as any, geminiController.listAIReplyLogs as any);
geminiRouter.patch("/ai-reply-logs/:id/feedback", requireAuth as any, validateRequest(feedbackSchema), geminiController.updateAIReplyFeedback as any);
geminiRouter.post("/sync-drive", requireAuth as any, validateRequest(syncDriveSchema), geminiController.syncGoogleDrive as any);

// Xưởng nội dung APIs (requireAuth bảo vệ tài khoản lưu lịch sử)
geminiRouter.post("/generate-image", requireAuth as any, validateRequest(generateImageSchema), geminiController.generateImage);
geminiRouter.post("/generate-video", requireAuth as any, validateRequest(generateVideoSchema), geminiController.generateVideo);
geminiRouter.post("/generate-voice", requireAuth as any, validateRequest(generateVoiceSchema), geminiController.generateVoice);
geminiRouter.post("/optimize-script", requireAuth as any, validateRequest(optimizeScriptSchema), geminiController.optimizeScript);
geminiRouter.post("/optimize-prompt", requireAuth as any, validateRequest(optimizePromptSchema), geminiController.optimizeImagePrompt);
geminiRouter.post("/optimize-video-prompt", requireAuth as any, validateRequest(optimizeVideoPromptSchema), geminiController.optimizeVideoPrompt);
geminiRouter.get("/media-history", requireAuth as any, validateRequest(getHistorySchema), geminiController.getMediaHistory);
geminiRouter.delete("/media-history/:id", requireAuth as any, validateRequest(deleteHistorySchema), geminiController.deleteMediaHistory);
