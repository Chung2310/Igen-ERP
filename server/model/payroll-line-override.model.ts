import { Schema, model } from "mongoose";
import type { IPayrollLineOverride } from "../interface/payroll-line-override.interface";

const schema = new Schema<IPayrollLineOverride>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  periodKey: { type: String, required: true },
  employeeId: { type: String, required: true },
  baseSalary: Number,
  adjustedBase: Number,
  overtime: Number,
  bonusTotal: Number,
  penaltyTotal: Number,
  socialInsurance: Number,
  healthInsurance: Number,
  unemploymentInsurance: Number,
  personalIncomeTax: Number,
  otherDeductions: Number,
  advances: Number,
  customValues: { type: Map, of: Number, default: {} },
  reason: { type: String, required: true, trim: true },
  version: { type: Number, required: true, default: 0 },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, periodKey: 1, employeeId: 1 }, { unique: true });

export const PayrollLineOverrideModel = model<IPayrollLineOverride>("PayrollLineOverride", schema);
