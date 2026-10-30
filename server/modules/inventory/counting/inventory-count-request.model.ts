import mongoose, { Schema } from "mongoose";

// No TTL: old retries must never become new writes after evidence expires.
const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  actorId: { type: String, required: true },
  requestId: { type: String, required: true },
  countId: { type: String, required: true },
  itemId: { type: String, required: true },
  fingerprint: { type: String, required: true },
  status: { type: String, enum: ["completed", "revoked"], required: true },
  committedVersion: { type: Number },
}, { timestamps: true, versionKey: false });
schema.index({ companyCode: 1, requestId: 1 }, { unique: true });
export const InventoryCountRequestModel = mongoose.model("InventoryCountRequest", schema);
