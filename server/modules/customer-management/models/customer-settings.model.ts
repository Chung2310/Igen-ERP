import { model, Schema } from "mongoose";
import type { ICustomerSettings } from "../interfaces/customer-settings.interface";

export const DEFAULT_CUSTOMER_TIERS = [
  { code: "bronze", name: "Hạng Đồng", minGrossProfit: 0, minSpend: 0, pointMultiplier: 1, color: "#CD7F32", discountPercent: 0 },
  { code: "silver", name: "Hạng Bạc", minGrossProfit: 1500000, minSpend: 5000000, pointMultiplier: 1.1, color: "#94A3B8", discountPercent: 3 },
  { code: "gold", name: "Hạng Vàng", minGrossProfit: 4000000, minSpend: 15000000, pointMultiplier: 1.2, color: "#F59E0B", discountPercent: 5 },
  { code: "diamond", name: "Kim Cương", minGrossProfit: 8000000, minSpend: 30000000, pointMultiplier: 1.5, color: "#06B6D4", discountPercent: 10 },
];

export const DEFAULT_POINTS_POLICY = {
  enabled: true,
  grossProfitPerPoint: 10000,
  pointRedeemValue: 1000,
  maxRedeemPercent: 50,
  minOrderTotalForRedeem: 50000,
  allowRepairRedeem: true,
  allowRetailRedeem: true,
};

const CustomerTierSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  minGrossProfit: { type: Number, required: true, default: 0, min: 0 },
  minSpend: { type: Number, default: 0, min: 0 },
  pointMultiplier: { type: Number, default: 1.0, min: 1 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  color: { type: String, default: "" },
}, { _id: false });

const PointsPolicySchema = new Schema({
  enabled: { type: Boolean, default: true },
  grossProfitPerPoint: { type: Number, default: 10000, min: 100 },
  pointRedeemValue: { type: Number, default: 1000, min: 1 },
  maxRedeemPercent: { type: Number, default: 50, min: 1, max: 100 },
  minOrderTotalForRedeem: { type: Number, default: 50000, min: 0 },
  allowRepairRedeem: { type: Boolean, default: true },
  allowRetailRedeem: { type: Boolean, default: true },
}, { _id: false });

const CustomerSettingsSchema = new Schema<ICustomerSettings>({
  companyCode: { type: String, required: true, index: true, unique: true },
  tierEvaluationMetric: { type: String, enum: ["gross_profit", "sales"], default: "gross_profit" },
  evaluationWindow: { type: String, enum: ["rolling12Months", "allTime"], default: "rolling12Months" },
  customerTiers: { type: [CustomerTierSchema], default: DEFAULT_CUSTOMER_TIERS },
  pointsPolicy: { type: PointsPolicySchema, default: () => ({ ...DEFAULT_POINTS_POLICY }) },
}, { timestamps: true, versionKey: false });

export const CustomerSettingsModel = model<ICustomerSettings>("CustomerSettings", CustomerSettingsSchema);
