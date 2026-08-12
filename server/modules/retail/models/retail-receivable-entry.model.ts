import { model, Schema } from "mongoose";
import type { IRetailReceivableEntry } from "../interfaces/retail-receivable.interface";

const schema = new Schema<IRetailReceivableEntry>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  orderId: { type: String, index: true },
  type: { type: String, enum: ["charge", "payment", "adjustment", "reversal"], required: true },
  amount: { type: Number, required: true, min: 1 },
  signedAmount: { type: Number, required: true },
  reason: String,
  reversesEntryId: String,
  idempotencyKey: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
}, { timestamps: true });

schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ companyCode: 1, reversesEntryId: 1 }, { unique: true, partialFilterExpression: { reversesEntryId: { $type: "string" } } });
schema.index({ companyCode: 1, branchId: 1, customerId: 1, createdAt: 1 });

export const RetailReceivableEntryModel = model<IRetailReceivableEntry>("RetailReceivableEntry", schema);
