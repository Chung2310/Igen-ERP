import { Schema, model } from "mongoose";
import { MARKETING_AUTOMATION_TYPES } from "../permissions";

/** Một lần quét gửi tin theo lịch. `cycleKey` unique để không quét trùng trong cùng ngày. */
const MarketingRunSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  automationType: { type: String, enum: MARKETING_AUTOMATION_TYPES as unknown as string[], required: true },
  businessDate: { type: String, required: true },
  cycleKey: { type: String, required: true, unique: true },
  trigger: { type: String, enum: ["scheduled", "manual"], required: true },
  status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
  eligible: { type: Number, default: 0 },
  queued: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  actorId: { type: String, default: "" },
  error: { type: String, default: "" },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, { timestamps: true, versionKey: false });

MarketingRunSchema.index({ companyCode: 1, startedAt: -1 });
export const MarketingRunModel = model("MarketingRun", MarketingRunSchema);
