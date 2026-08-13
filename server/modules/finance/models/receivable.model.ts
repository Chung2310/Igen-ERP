import { model, Schema } from "mongoose";
import { RECEIVABLE_STATUSES, type IReceivable } from "../interfaces/receivable.interface";

const nonNegativeInteger = { validator: Number.isSafeInteger, message: "Amount must be an integer VND value." };

const schema = new Schema<IReceivable>({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  receivableCode: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, required: true },
  sourceType: { type: String, required: true },
  sourceId: { type: String, required: true },
  sourceCode: String,
  sourceEventId: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  originalAmount: { type: Number, required: true, min: 1, validate: nonNegativeInteger },
  paidAmount: { type: Number, required: true, min: 0, default: 0, validate: nonNegativeInteger },
  adjustedAmount: { type: Number, required: true, default: 0, validate: nonNegativeInteger },
  balance: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  status: { type: String, enum: RECEIVABLE_STATUSES, required: true, default: "open" },
  daysOverdue: { type: Number, required: true, min: 0, default: 0, validate: nonNegativeInteger },
  lastReminderAt: Date,
  reminderCount: { type: Number, required: true, min: 0, default: 0, validate: nonNegativeInteger },
  reminderSuspendedUntil: Date,
  reminderSuspendReason: String,
}, { timestamps: true });

schema.index({ companyCode: 1, receivableCode: 1 }, { unique: true });
schema.index({ companyCode: 1, sourceEventId: 1 }, { unique: true });
schema.index({ companyCode: 1, sourceType: 1, sourceId: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, status: 1, dueDate: 1 });
schema.index({ companyCode: 1, customerId: 1, status: 1 });

export const ReceivableModel = model<IReceivable>("FinanceReceivable", schema);
