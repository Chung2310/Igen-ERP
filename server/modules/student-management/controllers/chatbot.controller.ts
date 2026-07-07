import { Response, NextFunction } from "express";
import { ChatbotService } from "../services/chatbot.service";
import { AuthRequest } from "../middlewares/auth.middleware";

export class ChatbotController {
  static async chat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { messages } = req.body;
      const ownerId = req.user!.uid;
      const reply = await ChatbotService.getResponse(ownerId, messages);
      res.json({ success: true, reply });
    } catch (error: unknown) {
      next(error);
    }
  }
}
