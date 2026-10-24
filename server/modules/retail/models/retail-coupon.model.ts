import { model, Schema } from "mongoose";

export interface RetailCoupon {
  companyCode: string;
  branchId: string;
  code: string;
  name: string;
  discountType: "amount" | "percent";
  value: number;
  minSubtotal: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  customerId?: string;
  customerTierCodes: string[];
  source: "manual" | "birthday" | "purchase";
  issuanceKey?: string;
  sourceOrderId?: string;
  triggerThreshold?: number;
  deliveryStatus?: "pending" | "sending" | "sent" | "failed" | "skipped";
  deliveryError?: string;
  deliveryStartedAt?: Date;
  deliverySentAt?: Date;
  deliveryMessageId?: string;
  version: number;
  createdBy: string;
  updatedBy: string;
}

const schema = new Schema<RetailCoupon>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true },
  discountType: { type: String, enum: ["amount", "percent"], required: true },
  value: { type: Number, required: true, min: 0 },
  minSubtotal: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, min: 0 },
  usageLimit: { type: Number, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  active: { type: Boolean, default: true },
  customerId: String,
  customerTierCodes: { type: [String], default: [] },
  source: { type: String, enum: ["manual", "birthday", "purchase"], default: "manual" },
  issuanceKey: String,
  sourceOrderId: String,
  triggerThreshold: Number,
  deliveryStatus: { type: String, enum: ["pending", "sending", "sent", "failed", "skipped"] },
  deliveryError: String,
  deliveryStartedAt: Date,
  deliverySentAt: Date,
  deliveryMessageId: String,
  version: { type: Number, default: 0 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, issuanceKey: 1 }, { unique: true, partialFilterExpression: { issuanceKey: { $type: "string" } } });
schema.index({ companyCode: 1, customerId: 1, endsAt: 1 });
export const RetailCouponModel = model<RetailCoupon>("RetailCoupon", schema);
