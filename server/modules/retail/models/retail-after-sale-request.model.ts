import { model, Schema } from "mongoose";
const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  idempotencyKey: { type: String, required: true }, orderId: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  status: { type: String, enum: ["processing", "completed", "revoked"], required: true },
  documentId: String, expectedVersion: Number, baselineDigest: String,
}, { timestamps: true });
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
export const RetailAfterSaleRequestModel = model("RetailAfterSaleRequest", schema);
