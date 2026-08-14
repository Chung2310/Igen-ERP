import { model, Schema } from "mongoose";

const RetailDebtReminderDeliverySchema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true }, runId: { type: Schema.Types.ObjectId, required: true },
  orderId: { type: String, required: true }, recipientId: { type: String, required: true }, channel: { type: String, enum: ["notification", "email"], required: true },
  recipientType: { type: String, enum: ["customer", "creator"], required: true },
  status: { type: String, enum: ["queued", "sending", "sent", "failed", "duplicate"], default: "queued" }, attempt: { type: Number, default: 0 }, maxAttempts: { type: Number, required: true },
  payload: { type: Schema.Types.Mixed, required: true }, failureType: { type: String, enum: ["temporary", "permanent"] }, error: String, messageId: String, sentAt: Date, nextAttemptAt: Date,
}, { timestamps: true });
RetailDebtReminderDeliverySchema.index({ runId: 1, orderId: 1, recipientId: 1, channel: 1 }, { unique: true });
RetailDebtReminderDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
export const RetailDebtReminderDeliveryModel = model("RetailDebtReminderDelivery", RetailDebtReminderDeliverySchema);
