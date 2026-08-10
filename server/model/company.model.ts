import { Schema, model } from "mongoose";
import { ICompany } from "../interface/company.interface";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "../config/module-keys";

const CompanyDriveOAuthSchema = new Schema(
  {
    refreshToken: { type: String, default: "" },
    connectedEmail: { type: String, default: "" },
    connectedAt: { type: Date, default: null },
  },
  { _id: false }
);

const CompanyLocationConfigSchema = new Schema(
  {
    latitude: { type: Number, default: 10.7769 }, // default Bitexco coordinates
    longitude: { type: Number, default: 106.7009 },
    allowedRadius: { type: Number, default: 1000 }, // default 1000m
    addressName: { type: String, default: "Tòa nhà Bitexco" },
    checkInLimit: { type: String, default: "08:30" },
    checkOutLimit: { type: String, default: "17:30" },
    lunchBreakStart: { type: String, default: "12:00" },
    lunchBreakEnd: { type: String, default: "13:00" },
    workingDays: { type: [Number], default: () => [1, 2, 3, 4, 5] },
  },
  { _id: false }
);

const CompanyDashboardReportConfigSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    recipients: { type: [String], default: () => [] },
    hourLocal: { type: Number, default: 7, min: 0, max: 23 },
    lastSentDate: { type: String, default: "" }, // YYYY-MM-DD — chống gửi trùng trong ngày
  },
  { _id: false }
);

const CompanySmtpConfigSchema = new Schema({
  host: String, port: { type: Number, default: 587 }, secure: { type: Boolean, default: false }, user: String,
  passwordEncrypted: { type: String, select: false }, fromEmail: String, fromName: String, updatedAt: Date,
}, { _id: false });

const CelebrationTemplateSchema = new Schema({ subject: { type: String, default: "" }, html: { type: String, default: "" } }, { _id: false });
const CompanyCelebrationConfigSchema = new Schema({
  birthdayEnabled: { type: Boolean, default: false }, holidayEnabled: { type: Boolean, default: false }, sendTime: { type: String, default: "08:00" },
  birthdayTemplate: { type: CelebrationTemplateSchema, default: () => ({ subject: "Chúc mừng sinh nhật {{employeeName}}", html: "<p>Chúc mừng sinh nhật {{employeeName}}!</p>" }) },
  holidayTemplate: { type: CelebrationTemplateSchema, default: () => ({ subject: "Chúc mừng {{holidayName}}", html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>" }) },
  holidayOverrides: { type: [{ date: String, enabled: { type: Boolean, default: true }, subject: String, html: String }], default: () => [] },
}, { _id: false });

const CompanyVietqrConfigSchema = new Schema(
  {
    bankId: { type: String, default: "" },
    accountNo: { type: String, default: "" },
    accountName: { type: String, default: "" },
  },
  { _id: false }
);

const CompanySchema = new Schema<ICompany>({
  code: { type: String, required: true, unique: true, index: true, uppercase: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  ownerEmail: { type: String, required: true },
  businessType: { type: String, enum: ["education", "labor", "service", "recruitment", "general"], default: "general", index: true },
  enabledModules: { type: [String], enum: MODULE_KEYS, default: () => [...DEFAULT_MODULE_KEYS] },
  driveFolderLink: { type: String, default: "" },
  driveOAuth: { type: CompanyDriveOAuthSchema, default: () => ({}) },
  driveFolderId: { type: String, default: "" },
  locationConfig: { type: CompanyLocationConfigSchema, default: () => ({}) },
  annualLeaveDays: { type: Number, min: 0, default: 12 },
  dashboardReportConfig: { type: CompanyDashboardReportConfigSchema, default: () => ({}) },
  smtpConfig: { type: CompanySmtpConfigSchema, default: undefined },
  celebrationConfig: { type: CompanyCelebrationConfigSchema, default: () => ({}) },
  vietqrConfig: { type: CompanyVietqrConfigSchema, default: () => ({}) },
  lifecycleStatus: { type: String, enum: ["active", "suspended", "archived", "scheduled-deletion"], default: "active", index: true },
  lifecycleChangedAt: { type: Date, default: Date.now },
  deletionScheduledAt: { type: Date, default: null },
  retentionEndsAt: { type: Date, default: null },
  deletionReason: { type: String, default: "" },
});

export const CompanyModel = model<ICompany>("Company", CompanySchema);
