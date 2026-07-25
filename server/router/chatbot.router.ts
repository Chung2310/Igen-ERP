import { Router, type RequestHandler } from "express";
import Joi from "joi";
import { chatbotController } from "../controller/chatbot.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

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
  requireAuth as RequestHandler,
  requirePermission("chat:read") as RequestHandler,
  validateRequest(chatSchema),
  chatbotController.chat as unknown as RequestHandler
);
