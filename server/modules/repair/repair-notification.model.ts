import { Schema, model } from "mongoose";

const RepairNotificationSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true },
  branchId: { type: String, required: true },
  ticketId: { type: String, required: true, index: true },
  ticketCode: { type: String, required: true },
  event: { type: String, required: true },
  channel: { type: String, default: "" },
  recipient: { type: String, default: "" },
  status: { type: String, enum: ["sent", "failed", "skipped"], required: true },
  /** Lý do khi skipped/failed: NO_RECIPIENT, NO_CHANNEL, TEMPLATE_DISABLED, hoặc lỗi từ adapter. */
  reason: String,
  messageId: String,
  idempotencyKey: { type: String, required: true },
  sentAt: { type: Date, required: true },
}, { timestamps: true });
RepairNotificationSchema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
RepairNotificationSchema.index({ companyCode: 1, sentAt: -1 });
export const RepairNotificationModel = model("RepairNotification", RepairNotificationSchema);
