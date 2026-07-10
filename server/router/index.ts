import { Router } from "express";
import mongoose from "mongoose";
import { authRouter } from "./auth.router";
import { permissionRouter } from "./permission.router";
import { rolePermissionRouter } from "./role-permission.router";
import { crudRouter } from "./crud.router";
import { walletRouter } from "./wallet.router";
import { googleDriveRouter } from "./google-drive.router";
import { chatRouter } from "./chat.router";
import { resourceRouter } from "./resource.router";
import { studentManagementRouter } from "../modules/student-management/router";
import { timekeepingRouter } from "./timekeeping.router";
import { dashboardRouter } from "./dashboard.router";
import { pushRouter } from "./push.router";
import { mediaRouter } from "./media.router";
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

// Upload/download file qua Cloudinary — dùng chung cho chat, tài nguyên, kho, avatar
apiRouter.use("/media", mediaRouter);

// Gắn kết router Web Push (thông báo đẩy khi người dùng không mở web)
apiRouter.use("/push", pushRouter);

// Gắn kết router thông báo web
apiRouter.use("/notifications", notificationRouter);

// Gắn kết router chat nội bộ
apiRouter.use("/chat", chatRouter);

// Trợ lý ảo AI — chatbot ngữ cảnh dữ liệu doanh nghiệp

// Module Quản lý Học viên
apiRouter.use("/", studentManagementRouter);
