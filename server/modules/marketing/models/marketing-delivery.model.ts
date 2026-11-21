import { Schema, model } from "mongoose";
import { MARKETING_AUTOMATION_TYPES, MARKETING_CHANNELS } from "../permissions";

/**
 * Mỗi tin nhắn gửi đi là một bản ghi. `idempotencyKey` unique bảo đảm một khách
 * chỉ nhận một tin cho mỗi sự kiện, kể cả khi scan chạy lại hoặc worker retry.
 */
const MarketingDeliverySchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  automationType: { type: String, enum: MARKETING_AUTOMATION_TYPES as unknown as string[], required: true },
  channel: { type: String, enum: MARKETING_CHANNELS as unknown as string[], required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  runId: { type: String, default: "" },
  campaignId: { type: String, default: "" },
  customerId: { type: String, default: "" },
  customerName: { type: String, default: "" },
  recipient: { type: String, required: true },
  subject: { type: String, default: "" },
  body: { type: String, default: "" },
  attachmentRef: { type: Schema.Types.Mixed, default: null },
  status: { type: String, enum: ["queued", "sending", "sent", "skipped", "failed"], default: "queued" },
  attempt: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  error: { type: String, default: "" },
  messageId: { type: String, default: "" },
  sentAt: { type: Date },
}, { timestamps: true, versionKey: false });

MarketingDeliverySchema.index({ companyCode: 1, createdAt: -1 });
MarketingDeliverySchema.index({ companyCode: 1, automationType: 1, customerId: 1, createdAt: -1 });
export const MarketingDeliveryModel = model("MarketingDelivery", MarketingDeliverySchema);
