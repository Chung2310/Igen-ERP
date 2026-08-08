import { Router } from "express";
import multer from "multer";
import { QRAttendanceController } from "../controllers/qr-attendance.controller";
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

// Public route cho học viên điểm danh (bảo vệ bằng rate limiter)
router.post("/checkin", publicApiRateLimiter, imageUpload.single("file"), QRAttendanceController.checkin);
router.get("/session-info", publicApiRateLimiter, QRAttendanceController.getSessionInfo);
router.post("/device/forget", publicApiRateLimiter, QRAttendanceController.forgetDevice);

// Các routes cần đăng nhập (Giảng viên / Admin)
router.use(authMiddleware as any);
router.use(requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.read]) as any);
router.post("/session", requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as any, QRAttendanceController.createSession);
router.get("/session/:sessionId/token", QRAttendanceController.getToken);
router.get("/session/:sessionId/status", QRAttendanceController.getStatus);
router.post("/session/:sessionId/close", requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as any, QRAttendanceController.closeSession);

export default router;
