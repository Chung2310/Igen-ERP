import { model, Schema } from "mongoose";

export interface RetailPointPolicy {
  companyCode: string;
  enabled: boolean;
  earnVndPerPoint: number;
  redeemVndPerPoint: number;
  maxRedeemPercent: number;
  version: number;
  updatedBy: string;
}

const schema = new Schema<RetailPointPolicy>({
  companyCode: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  earnVndPerPoint: { type: Number, default: 10000, min: 1 },
  redeemVndPerPoint: { type: Number, default: 1000, min: 1 },
  maxRedeemPercent: { type: Number, default: 50, min: 0, max: 100 },
  version: { type: Number, default: 0 },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

export const RetailPointPolicyModel = model<RetailPointPolicy>("RetailPointPolicy", schema);
