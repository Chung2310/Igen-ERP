import { Router, RequestHandler } from "express";
import fs from "fs";
import path from "path";
import studentRoutes from "./routes/student.routes";
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
import assignmentRoutes from "./routes/assignment.routes";
import { logger } from "./config/logger";
import { authMiddleware, AuthRequest } from "./middlewares/auth.middleware";
import { EmailService } from "./services/email.service";

export const studentManagementRouter = Router();

studentManagementRouter.use("/students", studentRoutes);
studentManagementRouter.use("/exams", examRoutes);
studentManagementRouter.use("/payments", paymentRoutes);
studentManagementRouter.use("/student-notifications", notificationRoutes);
studentManagementRouter.use("/upload", uploadRoutes);
studentManagementRouter.use("/ai", aiRoutes);
studentManagementRouter.use("/chatbot", chatbotRoutes);
studentManagementRouter.use("/webhook", webhookRoutes);
studentManagementRouter.use("/courses", courseRoutes);
studentManagementRouter.use("/student-resources", resourceRoutes);
studentManagementRouter.use("/batches", batchRoutes);
studentManagementRouter.use("/schedule", scheduleRoutes);
studentManagementRouter.use("/partners", partnerRoutes);
studentManagementRouter.use("/assignments", assignmentRoutes);


studentManagementRouter.post("/send-email", authMiddleware as unknown as RequestHandler, async (req: AuthRequest, res) => {
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
