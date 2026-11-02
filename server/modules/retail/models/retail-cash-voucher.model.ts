import { model, Schema } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  businessDate: { type: String, required: true }, account: { type: String, enum: ["cash", "bank"], required: true },
  profitCategory: { type: String, enum: ["expense", "other"], required: true, default: "other" },
  direction: { type: String, enum: ["in", "out"], required: true }, amount: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true }, reference: String, sourceKey: { type: String, required: true },
  createdBy: { type: String, required: true }, createdAt: { type: Date, default: Date.now },
});
schema.index({ companyCode: 1, sourceKey: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, businessDate: 1 });
export const RetailCashVoucherModel = model("RetailCashVoucher", schema);
