import { Router } from "express";
import { zaloMessengerController } from "../controller/zalo-messenger.controller";
import { requireAuth } from "../middleware/auth";

export const zaloMessengerRouter = Router();

// Endpoint webhook của Zalo OA - Phải công khai (public) để Zalo gọi tới
zaloMessengerRouter.post("/webhook", zaloMessengerController.receiveWebhookEvent);

// Routes phục vụ Client Igen-ERP - Yêu cầu xác thực đăng nhập (requireAuth)
zaloMessengerRouter.post("/save-integration", requireAuth as any, zaloMessengerController.saveIntegration);
zaloMessengerRouter.delete("/integration", requireAuth as any, zaloMessengerController.removeIntegration);
zaloMessengerRouter.get("/diagnostics/oa", requireAuth as any, zaloMessengerController.diagnoseOaConfig);
zaloMessengerRouter.get("/conversations", requireAuth as any, zaloMessengerController.getConversations);
zaloMessengerRouter.get("/conversations/:recipientId/messages", requireAuth as any, zaloMessengerController.getMessages);
zaloMessengerRouter.post("/conversations/:recipientId/mark-read", requireAuth as any, zaloMessengerController.markRead);
zaloMessengerRouter.post("/reply", requireAuth as any, zaloMessengerController.sendReply);
