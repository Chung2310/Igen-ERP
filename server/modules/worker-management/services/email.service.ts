import nodemailer from "nodemailer";
import { logger } from "../config/logger";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface SmtpSettings {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSandboxEmail?: string;
}

export class EmailService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static transporters = new Map<string, any>();
  private static EtherealTransporter: any = null;

  private static async getTransporter(settings?: SmtpSettings) {
    const host = (settings?.smtpHost || process.env.SMTP_HOST)?.trim();
    const portVal =
      settings?.smtpPort !== undefined
        ? settings.smtpPort
        : process.env.SMTP_PORT;
    const portStr = String(portVal || "").trim();
    const secureVal =
      settings?.smtpSecure !== undefined
        ? settings.smtpSecure
        : process.env.SMTP_SECURE;
    const secureStr = String(secureVal || "").trim();
    const user = (settings?.smtpUser || process.env.SMTP_USER)?.trim();
    const pass = (settings?.smtpPass || process.env.SMTP_PASS)?.trim();

    if (!host || !portStr || !user || !pass) {
      if (process.env.DEPLOYMENT_ENV !== "production") {
        if (!this.EtherealTransporter) {
          logger.info(
            "SMTP configuration is missing. Creating a temporary Ethereal Email test account for development/staging...",
          );
          try {
            const testAccount = await nodemailer.createTestAccount();
            logger.info(
              `Ethereal Email account created: User=${testAccount.user}`,
            );
            this.EtherealTransporter = nodemailer.createTransport({
              host: testAccount.smtp.host,
              port: testAccount.smtp.port,
              secure: testAccount.smtp.secure,
              auth: {
                user: testAccount.user,
                pass: testAccount.pass,
              },
            });
          } catch (err) {
            logger.error(
              "Failed to create Ethereal Email test account: %o",
              err,
            );
            throw new Error("SMTP_CONFIG_missing");
          }
        }
        return this.EtherealTransporter;
      }
      throw new Error("SMTP_CONFIG_missing");
    }

    const configKey = `${host}:${portStr}:${secureStr}:${user}:${pass}`;

    // Reuse existing transporter if configuration hasn't changed
    if (this.transporters.has(configKey)) {
      return this.transporters.get(configKey);
    }

    const port = parseInt(portStr, 10);
    const secure = secureStr === "true" || secureVal === true;

    const transporter = nodemailer.createTransport({
      pool: true, // Enable connection pooling for faster bulk sending
      maxConnections: 5,
      maxMessages: 100,
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    this.transporters.set(configKey, transporter);
    return transporter;
  }

  /**
   * Verify SMTP connection status
   */
  static async verifyConnection(
    settings?: SmtpSettings,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transporter = await this.getTransporter(settings);
      await transporter.verify();
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "SMTP_CONFIG_missing") {
        logger.warn("SMTP verify connection: Configuration is missing.");
        return { success: false, error: error.message };
      }
      logger.error("SMTP verify connection error: %o", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Không thể kết nối máy chủ SMTP";
      return { success: false, error: msg };
    }
  }

  /**
   * Send an email via SMTP
   */
  static async sendMail(
    options: MailOptions,
    settings?: SmtpSettings,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = await this.getTransporter(settings);
      const isEthereal = transporter === this.EtherealTransporter;

      let from = (settings?.smtpFrom || process.env.SMTP_FROM)?.trim();
      if (!from) {
        if (isEthereal) {
          from = `"Hệ thống Quản lý (Ethereal)" <${transporter.options.auth.user}>`;
        } else {
          const defaultFrom = `"Hệ thống Quản lý" <${settings?.smtpUser || process.env.SMTP_USER}>`;
          from = defaultFrom;
        }
      }

      const sandboxEmail = (
        settings?.smtpSandboxEmail || process.env.SMTP_SANDBOX_EMAIL
      )?.trim();

      let targetEmail = options.to.trim();
      let finalSubject = options.subject.trim();

      if (sandboxEmail && !isEthereal) {
        targetEmail = sandboxEmail;
        finalSubject = `[SANDBOX - Học viên: ${options.to}] ${finalSubject}`;
      }

      const info = await transporter.sendMail({
        from,
        to: targetEmail,
        subject: finalSubject,
        html: options.html,
      });

      logger.info(`Email sent successfully: ${info.messageId}`);
      if (isEthereal) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info(`[ETHEREAL PREVIEW URL]: ${previewUrl}`);
      }
      return { success: true, messageId: info.messageId };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "SMTP_CONFIG_missing") {
        logger.warn("SMTP send mail: Configuration is missing.");
        return { success: false, error: error.message };
      }
      logger.error("SMTP send mail error: %o", error);
      const msg =
        error instanceof Error ? error.message : "Lỗi gửi mail qua SMTP";
      return { success: false, error: msg };
    }
  }
}
