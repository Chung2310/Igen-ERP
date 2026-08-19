import { Schema, model } from "mongoose";
import { MARKETING_CHANNELS } from "../permissions";

const AutomationSchema = new Schema({
  enabled: { type: Boolean, default: false },
  channels: { type: [String], enum: MARKETING_CHANNELS as unknown as string[], default: ["email"] },
  subject: { type: String, default: "" },
  html: { type: String, default: "" },
}, { _id: false });

const MarketingSettingsSchema = new Schema({
  companyCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  timeZone: { type: String, default: "Asia/Ho_Chi_Minh" },
  /** Giờ gửi các tin theo lịch (HH:mm giờ VN). Tin cảm ơn gửi ngay theo sự kiện. */
  sendTime: { type: String, default: "08:00", match: /^\d{2}:\d{2}$/ },
  thank_you: { type: AutomationSchema, default: () => ({}) },
  birthday: { type: AutomationSchema, default: () => ({}) },
  holiday: { type: AutomationSchema, default: () => ({}) },
  remarketing: { type: AutomationSchema, default: () => ({}) },
  /** Tin cảm ơn: gửi kèm hoá đơn PDF của đơn hàng (chỉ áp dụng kênh email). */
  attachInvoicePdf: { type: Boolean, default: false },
  /** Remarketing: khách không mua trong bao nhiêu ngày thì hỏi thăm. */
  remarketingInactiveDays: { type: Number, default: 90, min: 7, max: 3650 },
  /** Khoảng cách tối thiểu giữa 2 lần remarketing cho cùng một khách. */
  remarketingCooldownDays: { type: Number, default: 180, min: 7, max: 3650 },
  updatedBy: { type: String, default: "" },
}, { timestamps: true, versionKey: false });

export const MarketingSettingsModel = model("MarketingSettings", MarketingSettingsSchema);
