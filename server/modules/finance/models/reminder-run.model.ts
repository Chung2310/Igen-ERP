import { model, Schema } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true }, cycleKey: { type: String, required: true },
  businessDate: { type: String, required: true }, trigger: { type: String, enum: ["scheduled", "manual"], required: true },
  status: { type: String, enum: ["running", "completed", "failed"], default: "running" }, actorId: String,
  eligible: { type: Number, default: 0 }, queued: { type: Number, default: 0 }, skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 }, duplicates: { type: Number, default: 0 }, startedAt: { type: Date, required: true }, completedAt: Date, error: String,
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, cycleKey: 1 }, { unique: true });
export const ReminderRunModel = model("FinanceReminderRun", schema);
