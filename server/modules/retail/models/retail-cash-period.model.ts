import { model, Schema } from "mongoose";

const schema = new Schema({ companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  from: { type: String, required: true }, to: { type: String, required: true },
  count: { type: Number, required: true }, cashNet: { type: Number, required: true }, bankNet: { type: Number, required: true },
  digest: { type: String, required: true }, closedAt: { type: Date, default: Date.now }, closedBy: { type: String, required: true },
});
schema.index({ companyCode: 1, branchId: 1, from: 1, to: 1 }, { unique: true });
export const RetailCashPeriodModel = model("RetailCashPeriod", schema);
