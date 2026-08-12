import { model, Schema } from "mongoose";

const RetailDebtReminderRunSchema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true }, cycleKey: { type: String, required: true },
  businessDate: { type: String, required: true }, status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
  settings: { type: Schema.Types.Mixed, required: true }, overdueOrders: { type: Number, default: 0 }, recipients: { type: Number, default: 0 },
  total: { type: Number, default: 0 }, queued: { type: Number, default: 0 }, sent: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, duplicates: { type: Number, default: 0 },
  startedAt: { type: Date, required: true }, completedAt: Date, error: String,
}, { timestamps: true });
RetailDebtReminderRunSchema.index({ companyCode: 1, branchId: 1, cycleKey: 1 }, { unique: true });
export const RetailDebtReminderRunModel = model("RetailDebtReminderRun", RetailDebtReminderRunSchema);
