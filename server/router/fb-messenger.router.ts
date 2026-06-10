import { Router } from "express";
import { fbMessengerController } from "../controller/fb-messenger.controller";
import { requireAuth } from "../middleware/auth";

export const fbMessengerRouter = Router();

// Routes dành cho Webhook của Meta (Facebook) - Phải công khai (public) để Facebook gọi tới
fbMessengerRouter.get("/webhook", fbMessengerController.verifyWebhook);
fbMessengerRouter.post("/webhook", fbMessengerController.receiveWebhookEvent);

// Routes dành cho Igen-ERP Client (Frontend) - Bắt buộc yêu cầu đăng nhập (requireAuth)
fbMessengerRouter.get("/messenger/conversations", requireAuth as any, fbMessengerController.getConversations);
fbMessengerRouter.get("/messenger/conversations/:recipientId/messages", requireAuth as any, fbMessengerController.getMessages);
fbMessengerRouter.post("/messenger/reply", requireAuth as any, fbMessengerController.sendReply);
