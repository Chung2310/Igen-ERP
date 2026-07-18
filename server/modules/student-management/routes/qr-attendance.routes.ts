import { Router } from "express";
import { QRAttendanceController } from "../controllers/qr-attendance.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";

const router = Router();

// Public route cho học viên điểm danh (bảo vệ bằng rate limiter)
router.post("/checkin", publicApiRateLimiter, QRAttendanceController.checkin);
router.get("/session-info", publicApiRateLimiter, QRAttendanceController.getSessionInfo);

// Các routes cần đăng nhập (Giảng viên / Admin)
router.use(authMiddleware as any);
router.post("/session", QRAttendanceController.createSession);
router.get("/session/:sessionId/token", QRAttendanceController.getToken);
router.get("/session/:sessionId/status", QRAttendanceController.getStatus);
router.post("/session/:sessionId/close", QRAttendanceController.closeSession);

export default router;
