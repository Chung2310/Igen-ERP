import { Router } from "express";
import { googleDriveController } from "../controller/google-drive.controller";
import { requireAuth } from "../middleware/auth";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";

export const googleDriveRouter = Router();

// Route lấy link đăng nhập Google OAuth
googleDriveRouter.get("/auth-url", requireAuth as any, googleDriveController.initOAuth as any);

// Route callback tiếp nhận redirect từ Google (không cần requireAuth vì Google gọi trực tiếp)
googleDriveRouter.get("/callback", googleDriveController.oauthCallback as any);

// Route ngắt kết nối Google Drive
googleDriveRouter.post("/disconnect", requireAuth as any, googleDriveController.disconnect as any);

// Route lấy danh sách tài nguyên cá nhân
googleDriveRouter.get("/resources", requireAuth as any, googleDriveController.getResources as any);

// Route lấy danh sách tài nguyên nhóm
googleDriveRouter.get("/resources/group/:roomId", requireAuth as any, googleDriveController.getGroupResources as any);

// Route upload tài nguyên cá nhân
googleDriveRouter.post("/upload", expensiveApiRateLimiter, requireAuth as any, googleDriveController.uploadResource as any);

// Route upload tài nguyên nhóm
googleDriveRouter.post("/upload/group/:roomId", expensiveApiRateLimiter, requireAuth as any, googleDriveController.uploadGroupResource as any);

// Route tạo tài liệu/thư mục mới trên Google Drive
googleDriveRouter.post("/create-file", requireAuth as any, googleDriveController.createFile as any);

// Route cập nhật quyền tải lên tài nguyên nhóm
googleDriveRouter.put("/groups/:roomId/permissions", requireAuth as any, googleDriveController.updateGroupPermissions as any);

// Route xóa tài nguyên
googleDriveRouter.delete("/resources/:id", requireAuth as any, googleDriveController.deleteResource as any);

// Route di chuyển tài nguyên
googleDriveRouter.post("/resources/move", requireAuth as any, googleDriveController.moveResource as any);

// Route đổi tên tài nguyên
googleDriveRouter.patch("/resources/:id/rename", requireAuth as any, googleDriveController.renameResource as any);
