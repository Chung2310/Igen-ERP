import { model, Schema } from "mongoose";

const schema = new Schema({
  customerId: { type: String, default: null }, customerName: String, customerCode: String,
  source: { type: String, enum: ["manual", "birthday", "purchase"], default: "manual" }, issuanceKey: String,
  emailDelivery: { status: { type: String, enum: ["pending", "sending", "sent", "failed", "skipped"] }, sentAt: Date, startedAt: Date, messageId: String, reason: String },
  automationId: String, sourceOrderId: String, triggerThreshold: Number,
  customerTierCodes: { type: [String], default: [] },
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  code: { type: String, required: true }, name: { type: String, required: true },
  discountType: { type: String, enum: ["amount", "percent"], required: true },
  value: { type: Number, required: true }, minSubtotal: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: null }, usageLimit: { type: Number, default: null },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true },
  active: { type: Boolean, default: true }, usedCount: { type: Number, default: 0 },
  version: { type: Number, default: 0 }, createdBy: String, updatedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, issuanceKey: 1 }, { unique: true, partialFilterExpression: { issuanceKey: { $type: "string" } } });
schema.index({ companyCode: 1, branchId: 1, customerId: 1, endsAt: 1 });
schema.index({ "emailDelivery.status": 1, endsAt: 1 });
export const RetailCouponModel = model("RetailCoupon", schema);
