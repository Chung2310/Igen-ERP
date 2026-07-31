import { Schema, model } from "mongoose";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";

export type PayrollRevisionStatus = "running" | "completed" | "failed";

export interface IPayrollCalculationRevision {
  runId: string;
  companyCode: string;
  branchId: string;
  revision: number;
  status: PayrollRevisionStatus;
  lines: PayrollLineSnapshot[];
  totals: { grossPay: number; deductions: number; netPay: number };
  issues: Array<{ code: string; message: string; severity: "blocking" | "warning"; employeeId?: string }>;
  checksum?: string;
  checksumAlgorithm?: string;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

const schema = new Schema<IPayrollCalculationRevision>({
  runId: { type: String, required: true, index: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  revision: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["running", "completed", "failed"], required: true, index: true },
  lines: { type: Schema.Types.Mixed, required: true, default: [] },
  totals: {
    grossPay: { type: Number, required: true, min: 0, default: 0 },
    deductions: { type: Number, required: true, min: 0, default: 0 },
    netPay: { type: Number, required: true, min: 0, default: 0 },
  },
  issues: { type: Schema.Types.Mixed, required: true, default: [] },
  checksum: { type: String, index: true },
  checksumAlgorithm: { type: String, default: "sha256" },
  startedAt: Date,
  completedAt: Date,
  failedAt: Date,
}, { timestamps: true });

schema.index({ runId: 1, revision: 1 }, { unique: true });

export const PayrollCalculationRevisionModel = model<IPayrollCalculationRevision>("PayrollCalculationRevision", schema);
