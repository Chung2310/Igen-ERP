import { Router } from "express";
import { googleDriveController } from "../controller/google-drive.controller";
import { requireAuth } from "../middleware/auth";

export const googleDriveRouter = Router();

// Route lấy link đăng nhập Google OAuth
googleDriveRouter.get("/auth-url", requireAuth as any, googleDriveController.initOAuth as any);

// Route callback tiếp nhận redirect từ Google (không cần requireAuth vì Google gọi trực tiếp)
googleDriveRouter.get("/callback", googleDriveController.oauthCallback as any);

// Route ngắt kết nối Google Drive
googleDriveRouter.post("/disconnect", requireAuth as any, googleDriveController.disconnect as any);

// Route lấy danh sách tài nguyên
googleDriveRouter.get("/resources", requireAuth as any, googleDriveController.getResources as any);

// Route upload tài nguyên
googleDriveRouter.post("/upload", requireAuth as any, googleDriveController.uploadResource as any);

// Route xóa tài nguyên
googleDriveRouter.delete("/resources/:id", requireAuth as any, googleDriveController.deleteResource as any);
