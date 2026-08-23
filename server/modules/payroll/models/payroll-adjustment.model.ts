import { Schema, model } from "mongoose";
import type { IPayrollAdjustment } from "../interfaces/payroll-adjustment.interface";
const schema = new Schema<IPayrollAdjustment>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true }, periodKey: { type: String, required: true }, employeeId: { type: String, required: true },
  kind: { type: String, enum: ["allowance", "bonus", "deduction", "correction"], required: true }, amount: { type: Number, required: true, min: 0 }, reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ["draft", "pending", "approved", "rejected", "snapshotted"], default: "pending", index: true }, snapshotRevisionId: String, snapshotAt: Date, version: { type: Number, required: true, default: 0 }, createdBy: { type: String, required: true }, approvedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, periodKey: 1, employeeId: 1 });
export const PayrollAdjustmentModel = model<IPayrollAdjustment>("PayrollAdjustment", schema);
