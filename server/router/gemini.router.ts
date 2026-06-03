import { Router } from "express";
import Joi from "joi";
import { geminiController } from "../controller/gemini.controller";
import { validateRequest } from "../middleware/validation";

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
      autoClassify: Joi.boolean().required(),
      autoCloseDeal: Joi.boolean().required(),
      autoFeedback: Joi.boolean().required(),
      replyDelay: Joi.number().required(),
      advancedInstructions: Joi.string().allow(""),
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

// Đăng ký định tuyến API kèm Joi validation
geminiRouter.post("/chat", validateRequest(chatSchema), geminiController.chat);
geminiRouter.get("/marketing-suggestions", geminiController.getMarketingSuggestions);
geminiRouter.post("/marketing-pillars", validateRequest(pillarsSchema), geminiController.analyzeMarketingPillars);
geminiRouter.post("/marketing-ideas", validateRequest(ideasSchema), geminiController.generateMarketingIdeas);
geminiRouter.post("/marketing-develop", validateRequest(developSchema), geminiController.developMarketingIdea);
