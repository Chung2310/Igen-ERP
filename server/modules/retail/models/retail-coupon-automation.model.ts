import { model, Schema } from "mongoose";

const schema = new Schema({
  deliveryChannels: { type: [String], enum: ["email"], default: [] },
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  name: { type: String, required: true },
  trigger: { type: String, enum: ["birthday", "order_total"], required: true },
  orderMinTotal: { type: Number, default: null }, enabled: { type: Boolean, default: false }, activatedAt: Date,
  discountType: { type: String, enum: ["amount", "percent"], required: true },
  value: { type: Number, required: true }, minSubtotal: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null }, validityDays: { type: Number, default: 7 },
  version: { type: Number, default: 0 }, createdBy: String, updatedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, enabled: 1, trigger: 1 });
export const RetailCouponAutomationModel = model("RetailCouponAutomation", schema);
