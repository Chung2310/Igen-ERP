import { model, Schema } from "mongoose";
const schema = new Schema({
  companyCode: { type: String, required: true, index: true }, branchId: { type: String, required: true, index: true }, customerId: { type: String, required: true, index: true },
  sourceKey: { type: String, required: true }, status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" }, attempts: { type: Number, default: 0 }, lastError: String, completedAt: Date,
}, { timestamps: true });
schema.index({ companyCode: 1, sourceKey: 1 }, { unique: true });
schema.index({ status: 1, createdAt: 1 });
export const RetailCustomerTierJobModel = model("RetailCustomerTierJob", schema);
