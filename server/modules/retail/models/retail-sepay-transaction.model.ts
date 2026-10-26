import { model, Schema } from "mongoose";

const RetailSePayTransactionSchema = new Schema({
  provider: { type: String, required: true, default: "sepay" },
  transactionId: { type: String, required: true },
  referenceCode: String,
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  orderId: { type: String, index: true },
  orderCode: String,
  paymentCode: String,
  status: { type: String, enum: ["applied", "pending_review", "reviewed"], default: "applied", index: true },
  reviewReason: String,
  reviewNote: String,
  reviewedBy: String,
  reviewedAt: Date,
  accountNumber: { type: String, required: true },
  receivedAmount: { type: Number, required: true, min: 1 },
  appliedAmount: { type: Number, required: true, min: 0 },
  transactionDate: Date,
}, { timestamps: true });

RetailSePayTransactionSchema.index({ provider: 1, transactionId: 1 }, { unique: true });

export const RetailSePayTransactionModel = model("RetailSePayTransaction", RetailSePayTransactionSchema);
