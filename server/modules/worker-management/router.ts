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
import qrAttendanceRoutes from "./routes/qr-attendance.routes";
import studentOnlineAttendanceRoutes from "./routes/student-online-attendance.routes";
import studentAttendanceAttemptRoutes from "./routes/student-attendance-attempt.routes";
import studentFaceRoutes from "./routes/student-face.routes";
import assignmentRoutes from "./routes/assignment.routes";
import { logger } from "./config/logger";
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware";
import { EmailService } from "./services/email.service";
import { requireModule } from "../../middleware/require-module";
import { requireAnyPermission, requirePermission } from "../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "./permissions";

export const workerManagementRouter = Router();

const requireStudentModule = requireModule("worker") as RequestHandler;
const areaRead = (area: keyof typeof STUDENT_AREA_PERMISSIONS) =>
  requireAnyPermission([
    ...STUDENT_AREA_PERMISSIONS[area].read,
  ]) as RequestHandler;
const requirePartnerRead = requirePermission("partner:read") as RequestHandler;

workerManagementRouter.use("/auth", authRoutes);
workerManagementRouter.use("/students", publicStudentRouter);
workerManagementRouter.use(
  "/students",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-profile"),
  studentRoutes,
);
workerManagementRouter.use(
  "/students",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-profile"),
  studentFaceRoutes,
);
workerManagementRouter.use(
  "/exams",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("exam"),
  examRoutes,
);
workerManagementRouter.use(
  "/payments",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("payment"),
  paymentRoutes,
);
workerManagementRouter.use(
  "/student-notifications",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-notification"),
  notificationRoutes,
);
workerManagementRouter.use(
  "/upload",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-profile"),
  uploadRoutes,
);
workerManagementRouter.use(
  "/ai",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-profile"),
  aiRoutes,
);
workerManagementRouter.use(
  "/chatbot",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-profile"),
  chatbotRoutes,
);
workerManagementRouter.use("/webhook", webhookRoutes);
workerManagementRouter.use(
  "/courses",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("course"),
  courseRoutes,
);
workerManagementRouter.use(
  "/student-resources",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-resource"),
  resourceRoutes,
);
workerManagementRouter.use(
  "/batches",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("batch"),
  batchRoutes,
);
workerManagementRouter.use(
  "/schedule",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("batch"),
  scheduleRoutes,
);
workerManagementRouter.use(
  "/partners",
  authMiddleware as unknown as RequestHandler,
  requirePartnerRead,
  partnerRoutes,
);
workerManagementRouter.use(
  "/student-management/custom-fields",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("custom-field"),
  customFieldRoutes,
);
// KhÃ´ng gÃ¡c areaRead á»Ÿ Ä‘Ã¢y: GET cáº§n má»Ÿ cho má»i tÃ i khoáº£n trong cÃ´ng ty (nhÃ£n
// thá»±c thá»ƒ dÃ¹ng kháº¯p há»‡ thá»‘ng), cÃ²n PATCH Ä‘Ã£ cháº·n superadmin-only trong route.
workerManagementRouter.use(
  "/student-management/settings",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  moduleSettingsRoutes,
);
workerManagementRouter.use("/assignments", assignmentRoutes);
workerManagementRouter.use("/qr-attendance", qrAttendanceRoutes);
workerManagementRouter.use("/attendance/online", studentOnlineAttendanceRoutes);
workerManagementRouter.use(
  "/attendance/attempts",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("assignment"),
  studentAttendanceAttemptRoutes,
);

workerManagementRouter.post(
  "/send-email",
  authMiddleware as unknown as RequestHandler,
  requireStudentModule,
  areaRead("student-notification"),
  async (req: AuthRequest, res) => {
    try {
      const { to, subject, html, check } = req.body;

      if (check) {
        const checkResult = await EmailService.verifyConnection();
        if (!checkResult.success) {
          return res
            .status(400)
            .json({
              success: false,
              error: checkResult.error || "SMTP chÆ°a sáºµn sÃ ng.",
            });
        }
        return res.json({ success: true, status: "Ready" });
      }

      if (!to || !subject || !html) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Thiáº¿u thÃ´ng tin (to, subject, html)",
          });
      }

      const result = await EmailService.sendMail({ to, subject, html });
      if (!result.success) {
        return res
          .status(400)
          .json({
            success: false,
            error: result.error || "KhÃ´ng thá»ƒ gá»­i email.",
          });
      }

      res.json({ success: true, data: { id: result.messageId } });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Lá»—i há»‡ thá»‘ng";
      logger.error("Student module send-email error: %o", error);
      res.status(500).json({ success: false, error: message });
    }
  },
);
workerManagementRouter.post("/log-client-error", (req, res) => {
  const { error, info } = req.body;
  const logMessage = `[${new Date().toISOString()}] CLIENT ERROR: ${error}\nINFO: ${JSON.stringify(info)}\n\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "client_error.log"), logMessage);
    logger.error(
      `Client crash reported: ${error} - Info: ${JSON.stringify(info)}`,
    );
  } catch (err) {
    logger.error("Ghi log lá»—i client tháº¥t báº¡i: %o", err);
  }
  res.json({ success: true });
});
