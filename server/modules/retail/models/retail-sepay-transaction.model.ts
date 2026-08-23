import { model, Schema } from "mongoose";

const RetailSePayTransactionSchema = new Schema({
  provider: { type: String, required: true, default: "sepay" },
  transactionId: { type: String, required: true },
  referenceCode: String,
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  orderId: { type: String, required: true, index: true },
  orderCode: { type: String, required: true },
  accountNumber: { type: String, required: true },
  receivedAmount: { type: Number, required: true, min: 1 },
  appliedAmount: { type: Number, required: true, min: 1 },
  transactionDate: Date,
}, { timestamps: true });

RetailSePayTransactionSchema.index({ provider: 1, transactionId: 1 }, { unique: true });

export const RetailSePayTransactionModel = model("RetailSePayTransaction", RetailSePayTransactionSchema);
