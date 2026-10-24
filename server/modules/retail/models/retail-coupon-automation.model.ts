import { model, Schema } from "mongoose";

export interface RetailCouponAutomation {
  companyCode: string;
  branchId: string;
  name: string;
  trigger: "birthday" | "purchase";
  orderMinTotal?: number;
  enabled: boolean;
  activatedAt?: Date;
  discountType: "amount" | "percent";
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  validityDays: number;
  sendEmail: boolean;
  version: number;
  createdBy: string;
  updatedBy: string;
}

const schema = new Schema<RetailCouponAutomation>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  trigger: { type: String, enum: ["birthday", "purchase"], required: true },
  orderMinTotal: { type: Number, min: 1 },
  enabled: { type: Boolean, default: false },
  activatedAt: Date,
  discountType: { type: String, enum: ["amount", "percent"], required: true },
  value: { type: Number, required: true, min: 0 },
  minSubtotal: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, min: 0 },
  validityDays: { type: Number, required: true, min: 1, max: 365 },
  sendEmail: { type: Boolean, default: false },
  version: { type: Number, default: 0 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, enabled: 1, trigger: 1 });
export const RetailCouponAutomationModel = model<RetailCouponAutomation>("RetailCouponAutomation", schema);
