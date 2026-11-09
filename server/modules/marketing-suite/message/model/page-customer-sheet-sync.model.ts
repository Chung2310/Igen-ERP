import { Schema, model } from "mongoose";

const payloadSchema = new Schema({
  customerCode: String, name: String, phone: String, email: String,
  address: String, notes: String, pageName: String,
}, { _id: false });

const schema = new Schema({
  companyCode: { type: String, required: true },
  integrationId: { type: String, required: true },
  customerId: { type: String, required: true },
  destination: { type: String, required: true },
  payload: { type: payloadSchema, required: true },
  contentHash: { type: String, required: true },
  revision: { type: Number, default: 0 },
  status: { type: String, enum: ["pending", "syncing", "synced", "failed", "skipped"], default: "pending" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseId: String, leaseUntil: Date, syncedAt: Date,
  lastError: { type: String, default: "", maxlength: 1000 },
}, { timestamps: true });
schema.index({ companyCode: 1, integrationId: 1, customerId: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const PageCustomerSheetSyncModel = model("PageCustomerSheetSync", schema);
