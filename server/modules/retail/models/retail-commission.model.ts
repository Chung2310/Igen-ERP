import { model, Schema } from "mongoose";

const policy = new Schema({ companyCode: { type: String, required: true }, partnerId: { type: String, required: true },
  kind: { type: String, enum: ["sale", "repair"], required: true }, sku: { type: String, required: true, default: "*" },
  ratePercent: { type: Number, required: true, min: 0, max: 100 }, active: { type: Boolean, default: true },
  effectiveFrom: Date,
  updatedBy: String, version: { type: Number, default: 1 }, updatedAt: { type: Date, default: Date.now },
});
policy.index({ companyCode: 1, partnerId: 1, kind: 1, sku: 1 }, { unique: true });
export const RetailCommissionPolicyModel = model("RetailCommissionPolicy", policy);

const basePolicy = new Schema({
  companyCode: { type: String, required: true }, partnerId: { type: String, default: "" },
  effectiveAt: { type: Date, required: true },
  config: {
    phoneAmount: { type: Number, required: true }, accessoryBps: { type: Number, required: true }, repairBps: { type: Number, required: true },
  },
  createdBy: String, updatedBy: String,
}, { timestamps: true });
basePolicy.index({ companyCode: 1, partnerId: 1, effectiveAt: 1 }, { unique: true });
export const RetailCommissionBasePolicyModel = model("RetailCommissionBasePolicy", basePolicy);

const productCommission = new Schema({
  companyCode: { type: String, required: true }, sku: { type: String, required: true },
  rule: { type: Schema.Types.Mixed, default: null }, updatedBy: String,
}, { timestamps: true });
productCommission.index({ companyCode: 1, sku: 1 }, { unique: true });
export const RetailProductCommissionModel = model("RetailProductCommission", productCommission);

const ledger = new Schema({ companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  partnerId: { type: String, required: true }, sourceKey: { type: String, required: true }, sourceType: { type: String, required: true },
  sourceId: { type: String, required: true }, sourceCode: String, businessDate: { type: String, required: true }, sku: String,
  amount: { type: Number, required: true }, baseAmount: { type: Number, required: true }, ratePercent: { type: Number, required: true },
  rateType: { type: String, enum: ["amount", "percent"] }, rateValue: Number,
  policyId: String, reason: String, createdAt: { type: Date, default: Date.now },
});
ledger.index({ companyCode: 1, sourceKey: 1 }, { unique: true });
ledger.index({ companyCode: 1, partnerId: 1, businessDate: 1 });
export const RetailCommissionLedgerModel = model("RetailCommissionLedger", ledger);

const payout = new Schema({ companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  partnerId: { type: String, required: true }, amount: { type: Number, required: true, min: 1 },
  account: { type: String, enum: ["cash", "bank"], required: true, default: "bank" },
  idempotencyKey: { type: String, required: true }, reference: { type: String, required: true },
  businessDate: { type: String, required: true }, createdBy: { type: String, required: true }, createdAt: { type: Date, default: Date.now },
});
payout.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
export const RetailCommissionPayoutModel = model("RetailCommissionPayout", payout);

const account = new Schema({ companyCode: { type: String, required: true }, partnerId: { type: String, required: true },
  balance: { type: Number, default: 0 }, version: { type: Number, default: 0 },
});
account.index({ companyCode: 1, partnerId: 1 }, { unique: true });
export const RetailCommissionAccountModel = model("RetailCommissionAccount", account);
