import { model, Schema } from "mongoose";

export interface RetailPointLedger {
  companyCode: string;
  branchId?: string;
  customerId: string;
  sourceKey: string;
  sourceId?: string;
  type: "earn" | "redeem" | "refund_earn" | "refund_redeem" | "adjust";
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  actorId: string;
}

const schema = new Schema<RetailPointLedger>({
  companyCode: { type: String, required: true, index: true },
  branchId: String,
  customerId: { type: String, required: true, index: true },
  sourceKey: { type: String, required: true },
  sourceId: String,
  type: { type: String, enum: ["earn", "redeem", "refund_earn", "refund_redeem", "adjust"], required: true },
  points: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  reason: { type: String, required: true },
  actorId: { type: String, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, sourceKey: 1 }, { unique: true });
schema.index({ companyCode: 1, customerId: 1, createdAt: -1 });
export const RetailPointLedgerModel = model<RetailPointLedger>("RetailPointLedger", schema);
