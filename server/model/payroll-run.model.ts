import { Schema, model } from "mongoose";
import type { IPayrollRun } from "../interface/payroll-period.interface";
const schema = new Schema<IPayrollRun>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true }, periodKey: { type: String, required: true },
  status: { type: String, enum: ["draft", "attendance_locked", "calculated", "approved", "closed"], default: "draft", index: true },
  lines: [{ employeeId: { type: String, required: true }, calculation: { type: Schema.Types.Mixed, required: true } }],
  createdBy: { type: String, required: true }, approvedBy: String, closedBy: String, closedAt: Date,
}, { timestamps: true });
schema.index({ companyCode: 1, periodKey: 1 }, { unique: true });
export const PayrollRunModel = model<IPayrollRun>("PayrollRun", schema);
