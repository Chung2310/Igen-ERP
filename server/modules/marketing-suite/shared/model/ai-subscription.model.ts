import { Schema, model, type Types } from "mongoose";

export interface SubscriptionPlanRecord {
  code: string; name: string; description: string; durationDays: number; aiLimit: number; active: boolean;
  createdBy: string; createdAt: Date; updatedAt: Date;
}
const integer = { validator: Number.isSafeInteger, message: "Giá trị phải là số nguyên." };
const planSchema = new Schema<SubscriptionPlanRecord>({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true }, description: { type: String, default: "" },
  durationDays: { type: Number, required: true, min: 1, max: 3660, validate: integer },
  aiLimit: { type: Number, required: true, min: 1, max: 10_000_000, validate: integer },
  active: { type: Boolean, default: true }, createdBy: { type: String, required: true },
}, { timestamps: true });
export const AiSubscriptionPlanModel = model<SubscriptionPlanRecord>("AiSubscriptionPlan", planSchema);

export interface SubscriptionPeriodRecord {
  companyCode: string; planId: Types.ObjectId; planName: string; aiLimit: number;
  used: number; reserved: number; startsAt: Date; expiresAt: Date;
  status: "active" | "cancelled" | "replaced"; createdBy: string; createdAt: Date;
}
const periodSchema = new Schema<SubscriptionPeriodRecord>({
  companyCode: { type: String, required: true },
  planId: { type: Schema.Types.ObjectId, ref: "AiSubscriptionPlan", required: true },
  planName: { type: String, required: true }, aiLimit: { type: Number, required: true, min: 1, validate: integer },
  used: { type: Number, default: 0, min: 0 }, reserved: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, required: true }, expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["active", "cancelled", "replaced"], default: "active" },
  createdBy: { type: String, required: true },
}, { timestamps: true });
periodSchema.index({ companyCode: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
export const AiSubscriptionPeriodModel = model<SubscriptionPeriodRecord>("AiSubscriptionPeriod", periodSchema);

export interface AiUsageRecord {
  companyCode: string; subscriptionId: Types.ObjectId; userId?: string;
  requestKey: string; kind: string; model?: string; units: number;
  status: "reserved" | "succeeded" | "released"; campaignId?: string; slotId?: string;
  expiresAt: Date; completedAt?: Date; reason?: string; createdAt: Date;
}
const usageSchema = new Schema<AiUsageRecord>({
  companyCode: { type: String, required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: "AiSubscriptionPeriod", required: true },
  userId: String, requestKey: { type: String, required: true }, kind: { type: String, required: true }, model: String,
  units: { type: Number, required: true, min: 1, validate: integer },
  status: { type: String, enum: ["reserved", "succeeded", "released"], default: "reserved" },
  campaignId: String, slotId: String, expiresAt: { type: Date, required: true }, completedAt: Date, reason: String,
}, { timestamps: true });
usageSchema.index({ companyCode: 1, requestKey: 1 }, { unique: true });
usageSchema.index({ companyCode: 1, status: 1, expiresAt: 1 });
usageSchema.index({ companyCode: 1, campaignId: 1, slotId: 1, status: 1 });
export const AiUsageModel = model<AiUsageRecord>("AiUsage", usageSchema);
