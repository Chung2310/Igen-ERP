import { Schema, model } from "mongoose";

export interface IOperatingExpense {
  idempotencyKey?: string;
  companyCode: string;
  branchId?: string;
  category: string;
  description: string;
  amount: number;
  incurredOn: Date;
  status: "confirmed" | "void";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const OperatingExpenseSchema = new Schema<IOperatingExpense>({
  idempotencyKey: { type: String },
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true, index: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  incurredOn: { type: Date, required: true, index: true },
  status: { type: String, enum: ["confirmed", "void"], default: "confirmed", index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

OperatingExpenseSchema.index({ companyCode: 1, branchId: 1, incurredOn: -1 });
OperatingExpenseSchema.index({ companyCode: 1, branchId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

export const OperatingExpenseModel = model<IOperatingExpense>("OperatingExpense", OperatingExpenseSchema);
