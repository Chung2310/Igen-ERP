import { model, Schema } from "mongoose";

export interface IRetailCustomerTierHistory {
  companyCode: string;
  branchId: string;
  customerId: string;
  fromTierCode?: string;
  fromTierName?: string;
  toTierCode: string;
  toTierName: string;
  totalSales: number;
  reason: "automatic-sales-recalculation";
  source?: "automatic" | "manual";
  sourceKey?: string;
  changedAt: Date;
}

const schema = new Schema<IRetailCustomerTierHistory>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  fromTierCode: String,
  fromTierName: String,
  toTierCode: { type: String, required: true },
  toTierName: { type: String, required: true },
  totalSales: { type: Number, required: true, min: 0 },
  reason: { type: String, enum: ["automatic-sales-recalculation"], required: true },
  source: { type: String, enum: ["automatic", "manual"], default: "automatic" },
  sourceKey: String,
  changedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: false });

schema.index({ companyCode: 1, branchId: 1, customerId: 1, changedAt: -1 });
schema.index({ companyCode: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string" } } });
export const RetailCustomerTierHistoryModel = model<IRetailCustomerTierHistory>("RetailCustomerTierHistory", schema);
