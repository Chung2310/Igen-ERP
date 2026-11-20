import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  runId: { type: String, required: true, index: true },
  idempotencyKey: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["draft", "confirmed", "cancelled", "reversed"], required: true, default: "draft", index: true },
  lines: [{
    employeeId: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
  }],
  paymentDate: Date,
  createdBy: String,
  confirmedBy: String,
  cancelledBy: String,
  reversedBy: String,
  confirmedAt: Date,
  cancelledAt: Date,
  reversedAt: Date,
  evidenceUrl: String,
  note: String,
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, runId: 1, status: 1 });

export const PayrollPaymentModel = model("PayrollPayment", schema);
