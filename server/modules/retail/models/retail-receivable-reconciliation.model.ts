import { model, Schema } from "mongoose";

const DifferenceSchema = new Schema({ orderId: { type: String, required: true }, snapshotDue: { type: Number, required: true }, ledgerDue: { type: Number, required: true }, difference: { type: Number, required: true } }, { _id: false });
const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  differences: { type: [DifferenceSchema], default: [] },
  orderTotal: { type: Number, required: true },
  ledgerTotal: { type: Number, required: true },
  differenceTotal: { type: Number, required: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, createdAt: -1 });

export const RetailReceivableReconciliationModel = model("RetailReceivableReconciliation", schema);
