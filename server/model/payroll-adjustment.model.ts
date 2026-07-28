import { Schema, model } from "mongoose";
import type { IPayrollAdjustment } from "../interface/payroll-adjustment.interface";
const schema = new Schema<IPayrollAdjustment>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true }, periodKey: { type: String, required: true }, employeeId: { type: String, required: true },
  kind: { type: String, enum: ["allowance", "bonus", "deduction", "correction"], required: true }, amount: { type: Number, required: true, min: 0 }, reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true }, createdBy: { type: String, required: true }, approvedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, periodKey: 1, employeeId: 1 });
export const PayrollAdjustmentModel = model<IPayrollAdjustment>("PayrollAdjustment", schema);
