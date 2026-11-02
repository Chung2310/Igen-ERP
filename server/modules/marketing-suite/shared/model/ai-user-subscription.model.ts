import { Schema, model, type Types } from "mongoose";

export interface AiUserSubscriptionRecord {
  userId: Types.ObjectId; companyCode: string; planId: Types.ObjectId; planName: string;
  aiLimit: number; priceVnd: number; used: number; reserved: number;
  startsAt: Date; expiresAt: Date; status: "active" | "cancelled" | "replaced";
  createdBy: string; createdAt: Date;
}
const schema = new Schema<AiUserSubscriptionRecord>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  companyCode: { type: String, required: true, uppercase: true },
  planId: { type: Schema.Types.ObjectId, ref: "AiSubscriptionPlan", required: true },
  planName: { type: String, required: true },
  aiLimit: { type: Number, required: true, min: 1 },
  priceVnd: { type: Number, required: true, min: 0 },
  used: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ["active", "cancelled", "replaced"], default: "active" },
  createdBy: { type: String, required: true },
}, { timestamps: true });
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
export const AiUserSubscriptionModel = model<AiUserSubscriptionRecord>("AiUserSubscription", schema);
