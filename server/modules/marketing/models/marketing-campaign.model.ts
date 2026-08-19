import { Schema, model } from "mongoose";
import { MARKETING_CHANNELS } from "../permissions";

/** Chiến dịch lễ tết: chạy đúng ngày `runDate`, gửi cho các hạng khách hàng đã chọn. */
const MarketingCampaignSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  /** Ngày chạy dạng YYYY-MM-DD (giờ VN). */
  runDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  /** Rỗng = gửi cho mọi khách hàng đang hoạt động. */
  targetTierCodes: { type: [String], default: [] },
  channels: { type: [String], enum: MARKETING_CHANNELS as unknown as string[], default: ["email"] },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  createdBy: { type: String, default: "" },
}, { timestamps: true, versionKey: false });

MarketingCampaignSchema.index({ companyCode: 1, runDate: 1, enabled: 1 });
export const MarketingCampaignModel = model("MarketingCampaign", MarketingCampaignSchema);
