import { model, Schema } from "mongoose";

const schema = new Schema({
  deliveryChannels: { type: [String], enum: ["email"], default: [] },
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  enabled: { type: Boolean, default: false },
  discountType: { type: String, enum: ["amount", "percent"], default: "percent" },
  value: { type: Number, default: 10 }, minSubtotal: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null }, validityDays: { type: Number, default: 7 },
  version: { type: Number, default: 0 }, updatedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1 }, { unique: true });
export const RetailBirthdayProgramModel = model("RetailBirthdayProgram", schema);
