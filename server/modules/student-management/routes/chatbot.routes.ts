import { Router } from "express";
import { ChatbotController } from "../controllers/chatbot.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { chatSchema } from "../validations/chatbot.validation";

const router = Router();

router.use(authMiddleware);

router.post("/chat", validate(chatSchema), ChatbotController.chat);

export default router;
