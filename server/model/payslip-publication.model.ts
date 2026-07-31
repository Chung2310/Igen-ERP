import { Schema, model } from "mongoose";
import type { IPayslipPublication } from "../interface/payroll-payslip.interface";

const schema = new Schema<IPayslipPublication>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  runId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  revisionChecksum: { type: String, required: true },
  status: { type: String, enum: ["published", "withdrawn"], required: true, default: "published" },
  publishedBy: String, publishedAt: Date, withdrawnBy: String, withdrawnAt: Date,
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, runId: 1, employeeId: 1 }, { unique: true });
export const PayslipPublicationModel = model<IPayslipPublication>("PayslipPublication", schema);
