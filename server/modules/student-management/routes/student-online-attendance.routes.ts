import { Router } from "express";
import multer from "multer";
import { StudentOnlineAttendanceController } from "../controllers/student-online-attendance.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

// Public route cho học viên xác thực bằng mã + khuôn mặt (bảo vệ bằng rate limiter)
router.post("/checkin", publicApiRateLimiter, imageUpload.single("file"), StudentOnlineAttendanceController.checkin);

// Route cần đăng nhập (Giảng viên / Admin) - sinh mã và gửi email
router.post("/sessions", authMiddleware as any, requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as any, StudentOnlineAttendanceController.createSessions);

export default router;
