import { Router } from "express";
import Joi from "joi";
import { chatbotController } from "../controller/chatbot.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

export const chatbotRouter = Router();

const chatSchema = {
  body: Joi.object({
    messages: Joi.array()
      .items(
        Joi.object({
          role: Joi.string().valid("user", "assistant", "system").required(),
          content: Joi.string().required(),
        })
      )
      .min(1)
      .required(),
  }),
};

chatbotRouter.post(
  "/chat",
  requireAuth as any,
  validateRequest(chatSchema),
  chatbotController.chat as any
);
