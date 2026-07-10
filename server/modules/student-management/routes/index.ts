import { Router, RequestHandler } from "express";
import fs from "fs";
import path from "path";
import authRoutes from "./auth.routes";
import studentRoutes from "./student.routes";
import examRoutes from "./exam.routes";
import paymentRoutes from "./payment.routes";
import notificationRoutes from "./notification.routes";
import uploadRoutes from "./upload.routes";
import aiRoutes from "./ai.routes";
import chatbotRoutes from "./chatbot.routes";
import webhookRoutes from "./webhook.routes";
import courseRoutes from "./course.routes";
import resourceRoutes from "./resource.routes";
import batchRoutes from "./batch.routes";
import scheduleRoutes from "./schedule.routes";
import partnerRoutes from "./partner.routes";
import { logger } from "../config/logger";

const router = Router();

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/exams", examRoutes);
router.use("/payments", paymentRoutes);
router.use("/student-notifications", notificationRoutes);
router.use("/upload", uploadRoutes);
router.use("/ai", aiRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/webhook", webhookRoutes);
router.use("/courses", courseRoutes);
router.use("/student-resources", resourceRoutes);
router.use("/batches", batchRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/partners", partnerRoutes);

import { authMiddleware, AuthRequest } from "../middlewares/auth.middleware";
import { EmailService } from "../services/email.service";
import { AuthService } from "../services/auth.service";

router.post("/send-email", authMiddleware as unknown as RequestHandler, async (req: AuthRequest, res) => {
  try {
    const { to, subject, html, check } = req.body;

    const user = await AuthService.getUserProfile(req.user.uid);
    const smtpOwner = user && user.role === "user" && user.centerId
      ? await AuthService.getUserProfile(user.centerId)
      : user;
    const hasCustomSmtp = !!(smtpOwner && smtpOwner.smtpHost && smtpOwner.smtpUser && smtpOwner.smtpPass);
    const smtpSettings = hasCustomSmtp ? {
      smtpHost: smtpOwner.smtpHost,
      smtpPort: smtpOwner.smtpPort,
      smtpSecure: smtpOwner.smtpSecure,
      smtpUser: smtpOwner.smtpUser,
      smtpPass: smtpOwner.smtpPass,
      smtpFrom: smtpOwner.smtpFrom,
      smtpSandboxEmail: smtpOwner.smtpSandboxEmail,
    } : undefined;

    if (check) {
      const checkResult = await EmailService.verifyConnection(smtpSettings);
      if (!checkResult.success) {
        return res.status(400).json({
          success: false,
          error: checkResult.error === "SMTP_CONFIG_missing"
            ? "Cấu hình SMTP (host, port, user, pass) còn thiếu."
            : `Lỗi kết nối SMTP: ${checkResult.error}`
        });
      }
      return res.json({ success: true, status: 'Ready' });
    }

    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin (to, subject, html)' });
    }

    const result = await EmailService.sendMail({ to, subject, html }, smtpSettings);

    if (!result.success) {
      if (result.error === "SMTP_CONFIG_missing") {
        return res.status(400).json({
          success: false,
          error: "Hệ thống chưa được cấu hình máy chủ gửi thư SMTP. Vui lòng kiểm tra lại cấu hình."
        });
      }
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { id: result.messageId } });
  } catch (error: unknown) {
    logger.error("Server email error: %o", error);
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    res.status(500).json({ success: false, error: msg });
  }
});


// Endpoint to log client-side crashes and runtime errors
router.post("/log-client-error", (req, res) => {
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

export default router;
