import nodemailer from "nodemailer";

export interface RetailReminderMailer { send(input: { to: string; subject: string; text: string }): Promise<{ messageId: string }> }
export interface RetailSmtpConfig { host: string; port: number; secure: boolean; user: string; password: string; from: string }

export function readRetailSmtpConfig(env: NodeJS.ProcessEnv = process.env): RetailSmtpConfig {
  const host = String(env.RETAIL_SMTP_HOST || "").trim(), user = String(env.RETAIL_SMTP_USER || "").trim(), password = String(env.RETAIL_SMTP_PASSWORD || ""), from = String(env.RETAIL_SMTP_FROM || "").trim();
  const port = Number(env.RETAIL_SMTP_PORT || 587);
  if (!host || !user || !password || !from || !Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Retail SMTP configuration is incomplete");
  return { host, port, secure: String(env.RETAIL_SMTP_SECURE || "").toLowerCase() === "true" || port === 465, user, password, from };
}

export function redactRetailSmtpConfig(config: RetailSmtpConfig) { return { ...config, password: "[REDACTED]" }; }

export function createRetailReminderMailer(config = readRetailSmtpConfig()): RetailReminderMailer {
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.password } });
  return { async send(input) { const info = await transport.sendMail({ from: config.from, to: input.to, subject: input.subject, text: input.text }); return { messageId: String(info.messageId || "") }; } };
}
