import { model, Schema } from "mongoose";
import { RECEIVABLE_ENTRY_TYPES, type IReceivableEntry } from "../interfaces/receivable.interface";

const signedInteger = { validator: (value: number) => Number.isSafeInteger(value) && value !== 0, message: "Amount must be a non-zero integer VND value." };
const integer = { validator: Number.isSafeInteger, message: "Balance must be an integer VND value." };

const schema = new Schema<IReceivableEntry>({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  receivableId: { type: String, required: true },
  customerId: { type: String, required: true },
  type: { type: String, enum: RECEIVABLE_ENTRY_TYPES, required: true },
  amount: { type: Number, required: true, validate: signedInteger },
  balanceAfter: { type: Number, required: true, min: 0, validate: integer },
  reason: String,
  paymentMethod: String,
  reference: String,
  sourceEventId: String,
  idempotencyKey: { type: String, required: true },
  reversalOfEntryId: String,
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
}, { timestamps: true });

schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index(
  { companyCode: 1, sourceEventId: 1 },
  { unique: true, partialFilterExpression: { sourceEventId: { $type: "string" } } },
);
schema.index(
  { companyCode: 1, reversalOfEntryId: 1 },
  { unique: true, partialFilterExpression: { reversalOfEntryId: { $type: "string" } } },
);
schema.index({ companyCode: 1, receivableId: 1, createdAt: 1 });

export const ReceivableEntryModel = model<IReceivableEntry>("FinanceReceivableEntry", schema);
