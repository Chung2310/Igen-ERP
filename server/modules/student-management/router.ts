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
import { requirePermission } from "../../middleware/auth";

export const studentManagementRouter = Router();

const requireStudentModule = requireModule("student") as RequestHandler;
const requireStudentRead = requirePermission("student:read") as RequestHandler;

studentManagementRouter.use("/auth", authRoutes);
studentManagementRouter.use("/students", publicStudentRouter);
studentManagementRouter.use("/students", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, studentRoutes);
studentManagementRouter.use("/students", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, studentFaceRoutes);
studentManagementRouter.use("/exams", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, examRoutes);
studentManagementRouter.use("/payments", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, paymentRoutes);
studentManagementRouter.use("/student-notifications", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, notificationRoutes);
studentManagementRouter.use("/upload", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, uploadRoutes);
studentManagementRouter.use("/ai", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, aiRoutes);
studentManagementRouter.use("/chatbot", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, chatbotRoutes);
studentManagementRouter.use("/webhook", webhookRoutes);
studentManagementRouter.use("/courses", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, courseRoutes);
studentManagementRouter.use("/student-resources", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, resourceRoutes);
studentManagementRouter.use("/batches", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, batchRoutes);
studentManagementRouter.use("/schedule", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, scheduleRoutes);
studentManagementRouter.use("/partners", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, partnerRoutes);
studentManagementRouter.use("/student-management/custom-fields", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, customFieldRoutes);
studentManagementRouter.use("/student-management/settings", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, moduleSettingsRoutes);
studentManagementRouter.use("/assignments", assignmentRoutes);
studentManagementRouter.use("/qr-attendance", qrAttendanceRoutes);
studentManagementRouter.use("/attendance/online", studentOnlineAttendanceRoutes);
studentManagementRouter.use("/attendance/attempts", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, studentAttendanceAttemptRoutes);

studentManagementRouter.post("/send-email", authMiddleware as unknown as RequestHandler, requireStudentModule, requireStudentRead, async (req: AuthRequest, res) => {
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
