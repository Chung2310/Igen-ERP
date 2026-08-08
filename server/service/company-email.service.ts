import nodemailer from "nodemailer";
import { CompanyModel } from "../model/company.model";
import { decryptSecret, encryptSecret } from "../security/crypto";

export type SmtpInput = { host: string; port: number; secure: boolean; user: string; password?: string; fromEmail: string; fromName: string };

export const companyEmailService = {
  async resolveLegacySettings(companyCode: string) {
    const company: any = await CompanyModel.findOne({ code: companyCode }).select("+smtpConfig.passwordEncrypted").lean();
    const smtp = company?.smtpConfig;
    if (!smtp?.passwordEncrypted) return undefined;
    return { smtpHost: smtp.host, smtpPort: smtp.port, smtpSecure: smtp.secure, smtpUser: smtp.user, smtpPass: decryptSecret(smtp.passwordEncrypted), smtpFrom: `"${smtp.fromName}" <${smtp.fromEmail}>` };
  },
  async getSmtp(companyCode: string) {
    const company: any = await CompanyModel.findOne({ code: companyCode }).select("+smtpConfig.passwordEncrypted").lean();
    const smtp = company?.smtpConfig;
    return smtp ? { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, fromEmail: smtp.fromEmail, fromName: smtp.fromName, hasPassword: Boolean(smtp.passwordEncrypted) } : null;
  },
  async saveSmtp(companyCode: string, input: SmtpInput) {
    const current: any = await CompanyModel.findOne({ code: companyCode }).select("+smtpConfig.passwordEncrypted");
    if (!current) throw new Error("Cong ty khong ton tai");
    const previous = current.smtpConfig?.passwordEncrypted;
    const passwordEncrypted = input.password ? encryptSecret(input.password) : previous;
    if (!passwordEncrypted) throw new Error("Mat khau SMTP la bat buoc");
    current.smtpConfig = { ...input, passwordEncrypted, updatedAt: new Date() };
    await current.save();
    return this.getSmtp(companyCode);
  },
  async send(companyCode: string, message: { to: string; subject: string; html?: string; text?: string }) {
    const company: any = await CompanyModel.findOne({ code: companyCode }).select("+smtpConfig.passwordEncrypted").lean();
    const smtp = company?.smtpConfig;
    if (!smtp?.passwordEncrypted) throw new Error("SMTP chua duoc cau hinh");
    const transporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: decryptSecret(smtp.passwordEncrypted) } });
    const info = await transporter.sendMail({ from: `"${smtp.fromName}" <${smtp.fromEmail}>`, ...message });
    return { messageId: info.messageId };
  },
  async verify(companyCode: string) {
    const company: any = await CompanyModel.findOne({ code: companyCode }).select("+smtpConfig.passwordEncrypted").lean();
    const smtp = company?.smtpConfig;
    if (!smtp?.passwordEncrypted) throw new Error("SMTP chua duoc cau hinh");
    const transporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: decryptSecret(smtp.passwordEncrypted) } });
    await transporter.verify();
    return { success: true };
  },
};
