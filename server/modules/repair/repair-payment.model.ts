import { model, Schema } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  ticketId: { type: String, required: true, index: true }, ticketCode: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 }, idempotencyKey: { type: String, required: true },
  beforePaid: { type: Number, required: true, min: 0 }, afterPaid: { type: Number, required: true, min: 0 },
  dueAfter: { type: Number, required: true, min: 0 }, createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, ticketId: 1, createdAt: 1 });
export const RepairPaymentModel = model("RepairPayment", schema);
