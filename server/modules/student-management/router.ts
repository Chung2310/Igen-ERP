import { Router, RequestHandler } from "express";
import fs from "fs";
import path from "path";
import authRoutes from "./routes/auth.routes";
import studentRoutes, { publicStudentRouter } from "./routes/student.routes";
import examRoutes from "./routes/exam.routes";
import paymentRoutes from "./routes/payment.routes";
import notificationRoutes from "./routes/notification.routes";
import uploadRoutes from "./routes/upload.routes";
import aiRoutes from "./routes/ai.routes";
import chatbotRoutes from "./routes/chatbot.routes";
import webhookRoutes from "./routes/webhook.routes";
import courseRoutes from "./routes/course.routes";
import resourceRoutes from "./routes/resource.routes";
import batchRoutes from "./routes/batch.routes";
import scheduleRoutes from "./routes/schedule.routes";
import partnerRoutes from "./routes/partner.routes";
import customFieldRoutes from "./routes/custom-field.routes";
import moduleSettingsRoutes from "./routes/module-settings.routes";
import standardFieldRoutes from "./routes/standard-field.routes";
import qrAttendanceRoutes from "./routes/qr-attendance.routes";
import studentOnlineAttendanceRoutes from "./routes/student-online-attendance.routes";
import studentAttendanceAttemptRoutes from "./routes/student-attendance-attempt.routes";
import studentFaceRoutes from "./routes/student-face.routes";
import assignmentRoutes from "./routes/assignment.routes";
import studentQualityRoutes from "./routes/student-quality.routes";
import learningRoadmapRoutes from "./routes/learning-roadmap.routes";
import { logger } from "./config/logger";
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware";
import { EmailService } from "./services/email.service";
import { requireModule, getModuleStateForCompany, resolveModuleAccess } from "../../middleware/require-module";
import { requireAnyPermission, requirePermission } from "../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "./permissions";

export const studentManagementRouter = Router();

const studentModuleGuard = requireModule("student") as RequestHandler;
const workerModuleGuard = requireModule("worker") as RequestHandler;
const partnerModuleGuard = requireModule("partner") as RequestHandler;
export const resolveBusinessModuleKey = (originalUrl: string) =>
  originalUrl.includes("/worker-management/") ? "worker" : "student";
const requireStudentModule: RequestHandler = (req, res, next) => {
  const guard = resolveBusinessModuleKey(req.originalUrl) === "worker" ? workerModuleGuard : studentModuleGuard;
  return guard(req, res, next);
};
/**
 * Trường tùy chỉnh là hạ tầng dùng chung cho cả hai loại hình doanh nghiệp: tenant giáo dục
 * cấu hình cho hồ sơ học viên, tenant lao động cấu hình cho hồ sơ lao động (popup "Thêm lao
 * động" dùng lại chính component này). Đường dẫn nằm dưới tiền tố /student-management nên
 * resolveBusinessModuleKey luôn trả về "student"; nếu gác bằng đúng module student thì tenant
 * lao động — vốn bị filterModulesForBusinessType loại bỏ module student — luôn nhận 403.
 * Vì vậy chỉ cần một trong hai phân hệ được bật là cho qua.
 */
const requireSharedModule: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as { user?: { role?: string; companyCode?: string } }).user;
    if (user?.role === "superadmin") return next();
    if (!user?.companyCode) {
      return res.status(403).json({ status: "error", message: "Phân hệ chưa được kích hoạt cho doanh nghiệp của bạn." });
    }
    const state = await getModuleStateForCompany(user.companyCode);
    const allowed = (["student", "worker"] as const).some((key) =>
      resolveModuleAccess(user, key, state.modules, state.exists, state.businessType),
    );
    if (allowed) return next();
    console.log(`[requireSharedModule BLOCKED] Path: ${req.originalUrl}, UserCompany: ${user.companyCode}`);
    return res.status(403).json({ status: "error", message: "Phân hệ chưa được kích hoạt cho doanh nghiệp của bạn." });
  } catch (error) {
    return next(error);
  }
};
const areaRead = (area: keyof typeof STUDENT_AREA_PERMISSIONS) => requireAnyPermission([...STUDENT_AREA_PERMISSIONS[area].read]) as RequestHandler;
const requirePartnerRead = requirePermission("relationship:read") as RequestHandler;

studentManagementRouter.use("/auth", authRoutes);
studentManagementRouter.use("/students", publicStudentRouter);
studentManagementRouter.use("/students", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-profile"), studentRoutes);
studentManagementRouter.use("/students", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-profile"), studentFaceRoutes);
studentManagementRouter.use("/exams", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("exam"), examRoutes);
studentManagementRouter.use("/payments", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("payment"), paymentRoutes);
studentManagementRouter.use("/student-notifications", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-notification"), notificationRoutes);
studentManagementRouter.use("/upload", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-profile"), uploadRoutes);
studentManagementRouter.use("/ai", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-profile"), aiRoutes);
studentManagementRouter.use("/chatbot", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-profile"), chatbotRoutes);
studentManagementRouter.use("/webhook", webhookRoutes);
studentManagementRouter.use("/courses", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("course"), courseRoutes);
studentManagementRouter.use("/student-resources", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-resource"), resourceRoutes);
studentManagementRouter.use("/batches", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("batch"), batchRoutes);
studentManagementRouter.use("/schedule", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("batch"), scheduleRoutes);
studentManagementRouter.use("/partners", authMiddleware as unknown as RequestHandler, partnerModuleGuard, requirePartnerRead, partnerRoutes);
studentManagementRouter.use("/student-management/custom-fields", authMiddleware as unknown as RequestHandler, requireSharedModule, areaRead("custom-field"), customFieldRoutes);
// Không gác areaRead ở đây: GET cần mở cho mọi tài khoản trong công ty (nhãn
// thực thể dùng khắp hệ thống), còn PATCH đã chặn superadmin-only trong route.
studentManagementRouter.use("/student-management/settings", authMiddleware as unknown as RequestHandler, requireSharedModule, moduleSettingsRoutes);
// Cấu hình trường có sẵn: GET mở cho mọi tài khoản trong công ty (ai cũng cần để
// dựng form), PUT đã gác quyền settings:manage bên trong route.
studentManagementRouter.use("/student-management/standard-fields", authMiddleware as unknown as RequestHandler, requireSharedModule, standardFieldRoutes);
studentManagementRouter.use("/assignments", assignmentRoutes);
studentManagementRouter.use("/student-quality", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-quality"), studentQualityRoutes);
studentManagementRouter.use("/learning-roadmaps", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("learning-roadmap"), learningRoadmapRoutes);
studentManagementRouter.use("/qr-attendance", qrAttendanceRoutes);
studentManagementRouter.use("/attendance/online", studentOnlineAttendanceRoutes);
studentManagementRouter.use("/attendance/attempts", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("assignment"), studentAttendanceAttemptRoutes);

studentManagementRouter.post("/send-email", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead("student-notification"), async (req: AuthRequest, res) => {
  try {
    const { to, subject, html, check } = req.body;

    if (check) {
      const checkResult = await EmailService.verifyConnection();
      if (!checkResult.success) {
        return res.status(400).json({ success: false, error: checkResult.error || "SMTP chưa sẵn sàng." });
      }
      return res.json({ success: true, status: "Ready" });
    }

    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin (to, subject, html)" });
    }

    const result = await EmailService.sendMail({ to, subject, html });
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || "Không thể gửi email." });
    }

    res.json({ success: true, data: { id: result.messageId } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Lỗi hệ thống";
    logger.error("Student module send-email error: %o", error);
    res.status(500).json({ success: false, error: message });
  }
});

studentManagementRouter.post("/log-client-error", (req, res) => {
  const { error, info } = req.body;
  const logMessage = `[${new Date().toISOString()}] CLIENT ERROR: ${error}\nINFO: ${JSON.stringify(info)}\n\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "client_error.log"), logMessage);
    logger.error(`Client crash reported: ${error} - Info: ${JSON.stringify(info)}`);
  } catch (err) {
    logger.error("Ghi log lỗi client thất bại: %o", err);
  }
  res.json({ success: true });
});
