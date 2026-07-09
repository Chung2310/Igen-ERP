import { Router } from "express";
import mongoose from "mongoose";
import { geminiRouter } from "./gemini.router";
import { elevenlabsRouter } from "./elevenlabs.router";
import { facebookPostRouter } from "./facebook-post.router";
import { fbMessengerRouter } from "./fb-messenger.router";
import { zaloMessengerRouter } from "./zalo-messenger.router";
import { tiktokMessengerRouter } from "./tiktok-messenger.router";
import { tiktokRouter } from "./tiktok.router";
import { tiktokController } from "../controller/tiktok.controller";
import { schedulerRouter } from "./scheduler.router";
import { mediaRouter } from "./media.router";
import { authRouter } from "./auth.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { crudRouter } from "./crud.router";
import { heygenRouter } from "./heygen.router";
import { walletRouter } from "./wallet.router";
import { professionalRouter } from "./professional.router";
import { klingRouter } from "./kling.router";
import { opusclipRouter } from "./opusclip.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { chatbotRouter } from "./chatbot.router";
import { resourceRouter } from "./resource.router";
import { studentManagementRouter } from "../modules/student-management/router";
import { timekeepingRouter } from "./timekeeping.router";
import { dashboardRouter } from "./dashboard.router";
import { notificationRouter } from "./notification.router";
export const apiRouter = Router();
/**
 * GET /api/v1/health
 * Health Check API để giám sát trạng thái của hệ thống
 */
apiRouter.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      server: "up",
      database: isDbConnected ? "online (connected via MongoDB)" : "offline",
    },
  });
});

// Gắn kết router phụ của Gemini
apiRouter.use("/gemini", geminiRouter);

// Gắn kết router phụ của ElevenLabs
apiRouter.use("/elevenlabs", elevenlabsRouter);
apiRouter.use("/heygen", heygenRouter);

// ==== TẠM ẨN: route BE của module MARKETING & SALES CRM ====
// Đã comment phần đăng ký route để ẩn tạm 2 module; controller/service giữ nguyên.
// Bỏ comment khối này để khôi phục hoàn toàn.
//
// // Gắn kết router phụ của Facebook Post qua n8n & Facebook Messenger
// apiRouter.use("/facebook", facebookPostRouter);
// apiRouter.use("/facebook", fbMessengerRouter);
// apiRouter.use("/zalo", zaloMessengerRouter);
// apiRouter.use("/tiktok/messenger", tiktokMessengerRouter);
//
// // Gắn kết router phụ của TikTok
// apiRouter.get("/webhooks/tiktok", (req, res) => {
//   return res.status(200).json({
//     status: "ok",
//     path: "/api/v1/webhooks/tiktok",
//     message: "TikTok webhook endpoint is reachable",
//     timestamp: new Date().toISOString(),
//   });
// });
// apiRouter.post("/webhooks/tiktok", tiktokController.receiveWebhook as any);
// apiRouter.use("/tiktok", tiktokRouter);
// apiRouter.use("/tiktok-business", tiktokRouter);
//
// // Gắn kết router phụ của Scheduler (lên lịch đăng bài marketing)
// apiRouter.use("/scheduler", schedulerRouter);
// ==== HẾT phần tạm ẩn ====

// Gắn kết router phụ của Media Cloudinary Relay
apiRouter.use("/media", mediaRouter);

// Gắn kết router phụ của Google Drive Tích hợp cá nhân
apiRouter.use("/integrations/google-drive", googleDriveRouter);

// Quản lý tài nguyên — file explorer nội bộ + tài liệu Google Drive
apiRouter.use("/resources", resourceRouter);

// Gắn kết router phụ của Xác thực JWT
apiRouter.use("/auth", authRouter);

// Gắn kết router phụ của Quản lý mã quyền hệ thống
apiRouter.use("/permissions", permissionRouter);

// Gắn kết router phụ của Cấu hình gán quyền cho Role theo doanh nghiệp
apiRouter.use("/role-permissions", rolePermissionRouter);

// Gắn kết router ví của người dùng & nạp tiền PayOS
apiRouter.use("/wallet", walletRouter);

// Gắn kết router CRUD đa năng (MongoDB)
apiRouter.use("/crud", crudRouter);

// Gắn kết router chấm công (GPS Timekeeping)
apiRouter.use("/timekeeping", timekeepingRouter);

// Gắn kết router tổng hợp số liệu trang tổng quan
apiRouter.use("/dashboard", dashboardRouter);

// Gắn kết router thông báo web
apiRouter.use("/notifications", notificationRouter);

// Gắn kết router chat nội bộ
apiRouter.use("/chat", chatRouter);

// Public Professional Video Render API (auth bằng X-API-Key header)
apiRouter.use("/professional", professionalRouter);

// Kling AI — Motion Control video generation
apiRouter.use("/kling", klingRouter);

// OpusClip AI — Long-to-Short video clipping
apiRouter.use("/opusclip", opusclipRouter);

// Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp
apiRouter.use("/chatbot", chatbotRouter);

// Quản lý tài nguyên — file explorer nội bộ + tài liệu Google Drive
apiRouter.use("/resources", resourceRouter);

// Module Quản lý Học viên
apiRouter.use("/", studentManagementRouter);
