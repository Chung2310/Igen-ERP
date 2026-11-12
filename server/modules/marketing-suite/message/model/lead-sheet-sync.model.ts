import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  integrationId: { type: String, required: true },
  leadId: { type: String, required: true },
  destination: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  contentHash: { type: String, required: true },
  revision: { type: Number, default: 0 },
  sheetRow: { type: Number, min: 2 },
  status: { type: String, enum: ["pending", "syncing", "synced", "failed", "skipped"], default: "pending" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: String,
  leaseUntil: Date,
  syncedAt: Date,
  lastError: { type: String, default: "", maxlength: 1000 },
}, { timestamps: true });
schema.index({ companyCode: 1, integrationId: 1, leadId: 1 }, { unique: true });
schema.index({ companyCode: 1, integrationId: 1, status: 1 });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });

export const LeadSheetSyncModel = model("LeadSheetSync", schema);
