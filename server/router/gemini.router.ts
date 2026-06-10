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
  }),
};

const developSchema = {
  body: Joi.object({
    title: Joi.string().required(),
    summary: Joi.string().required(),
    suggestedContent: Joi.string().required(),
    channels: Joi.array().items(Joi.string()).required(),
  }),
};

const generateImageSchema = {
  body: Joi.object({
    prompt: Joi.string().required(),
  }),
};

const generateVideoSchema = {
  body: Joi.object({
    prompt: Joi.string().required(),
    durationSeconds: Joi.number().valid(4, 6, 8).optional(),
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
geminiRouter.post("/generate-image", validateRequest(generateImageSchema), geminiController.generateImage);
geminiRouter.post("/generate-video", validateRequest(generateVideoSchema), geminiController.generateVideo);
geminiRouter.get("/knowledge-health", requireAuth as any, geminiController.getKnowledgeHealth as any);
geminiRouter.post("/test-reply", requireAuth as any, validateRequest(testReplySchema), geminiController.testReply as any);
geminiRouter.get("/ai-reply-logs", requireAuth as any, geminiController.listAIReplyLogs as any);
geminiRouter.patch("/ai-reply-logs/:id/feedback", requireAuth as any, validateRequest(feedbackSchema), geminiController.updateAIReplyFeedback as any);
geminiRouter.post("/sync-drive", requireAuth as any, validateRequest(syncDriveSchema), geminiController.syncGoogleDrive as any);
