import { Schema, model } from "mongoose";
import type { IPayrollPolicy } from "../interfaces/payroll-policy.interface";

const fundSchema = new Schema({
  code: { type: String, enum: ["social", "health", "unemployment", "accident", "union"], required: true },
  employeeRate: { type: Number, required: true, min: 0, max: 1 },
  employerRate: { type: Number, required: true, min: 0, max: 1 },
  capBasis: { type: String, enum: ["baseSalary", "regionalMinimum", "none"], required: true },
}, { _id: false });

const bracketSchema = new Schema({
  upTo: { type: Number, min: 0 },
  rate: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false });

const schema = new Schema<IPayrollPolicy>({
  companyCode: { type: String, required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ["draft", "active", "retired"], required: true, default: "draft", index: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  sourceReference: String,
  baseSalary: { type: Number, required: true, min: 0 },
  regionalMinimumWage: { type: Number, required: true, min: 0 },
  socialCapMultiplier: { type: Number, required: true, min: 1, default: 20 },
  unemploymentCapMultiplier: { type: Number, required: true, min: 1, default: 20 },
  funds: { type: [fundSchema], required: true },
  personalDeduction: { type: Number, required: true, min: 0 },
  dependentDeduction: { type: Number, required: true, min: 0 },
  taxBrackets: { type: [bracketSchema], required: true },
  shortTermWithholdingRate: { type: Number, required: true, min: 0, max: 1, default: 0.1 },
  shortTermWithholdingThreshold: { type: Number, required: true, min: 0, default: 2_000_000 },
  nonResidentRate: { type: Number, required: true, min: 0, max: 1, default: 0.2 },
  overtime: {
    weekday: { type: Number, required: true, min: 1, default: 1.5 },
    restDay: { type: Number, required: true, min: 1, default: 2 },
    holiday: { type: Number, required: true, min: 1, default: 3 },
    nightPremium: { type: Number, required: true, min: 0, default: 0.3 },
    nightOvertimeBonus: { type: Number, required: true, min: 0, default: 0.2 },
  },
  roundingUnit: { type: Number, required: true, min: 1, default: 1 },
  createdBy: { type: String, required: true },
  activatedBy: String,
  activatedAt: Date,
  retiredBy: String,
}, { timestamps: true, optimisticConcurrency: true, versionKey: "version" });

schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, status: 1, effectiveFrom: -1 });

export const PayrollPolicyModel = model<IPayrollPolicy>("PayrollPolicy", schema);
