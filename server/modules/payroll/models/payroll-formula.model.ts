import { Schema, model } from "mongoose";
import type { IPayrollFormula } from "../interfaces/payroll-formula.interface";

const schema = new Schema<IPayrollFormula>({
  companyCode: { type: String, required: true, index: true }, code: { type: String, required: true, trim: true }, name: { type: String, required: true, trim: true }, description: String,
  status: { type: String, enum: ["draft", "active", "retired"], default: "draft", index: true }, resultBucket: { type: String, enum: ["allowance", "bonus", "deduction", "adjustment"], required: true },
  priority: { type: Number, required: true }, effectiveFrom: { type: Date, default: Date.now }, effectiveTo: Date,
  conditions: { type: Schema.Types.Mixed, required: true }, expression: { type: Schema.Types.Mixed, required: true }, rounding: { type: Schema.Types.Mixed, required: true },
  createdBy: { type: String, required: true }, activatedBy: String, activatedAt: Date, retiredBy: String,
}, { timestamps: true, versionKey: "version" });
schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, status: 1, priority: 1, code: 1 });
export const PayrollFormulaModel = model<IPayrollFormula>("PayrollFormula", schema);
