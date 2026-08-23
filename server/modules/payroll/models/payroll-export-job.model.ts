import { Schema, model } from "mongoose";
import type { IPayrollExportJob } from "../interfaces/payroll-export.interface";

const schema = new Schema<IPayrollExportJob>({
  companyCode: { type: String, required: true, index: true }, branchId: { type: String, required: true, index: true },
  runId: { type: String, required: true, index: true }, type: { type: String, enum: ["detailed", "insurance", "pit", "bank_transfer"], required: true },
  revisionChecksum: { type: String, required: true }, status: { type: String, enum: ["queued", "completed", "failed"], required: true, default: "queued" },
  createdBy: { type: String, required: true }, filters: Schema.Types.Mixed, output: Schema.Types.Mixed, error: String, completedAt: Date,
}, { timestamps: true });
export const PayrollExportJobModel = model<IPayrollExportJob>("PayrollExportJob", schema);
