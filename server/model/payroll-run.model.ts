import { Schema, model } from "mongoose";
import type { IPayrollRun } from "../interface/payroll-period.interface";

type PayrollRunDocument = IPayrollRun & {
  startDate: Date;
  endDate: Date;
  type: "regular" | "supplemental";
  version: number;
  issues: {
    code: string;
    message: string;
    runId: string;
    employeeId?: string;
    field?: string;
    severity: "blocking" | "warning";
    remediation: string;
  }[];
  totals: {
    grossPay: number;
    deductions: number;
    netPay: number;
  };
};

const schema = new Schema<PayrollRunDocument>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  periodKey: { type: String, required: true },
  startDate: Date,
  endDate: Date,
  type: { type: String, enum: ["regular", "supplemental"], default: "regular", required: true },
  parentRunId: String,
  activeRevisionId: String,
  activeRevisionChecksum: String,
  supplementalReason: String,
  status: { type: String, enum: ["draft", "attendance_locked", "calculated", "reviewed", "approved", "closed", "partially_paid", "paid"], default: "draft", index: true },
  lines: [{ employeeId: { type: String, required: true }, calculation: { type: Schema.Types.Mixed, required: true } }],
  issues: [{
    code: { type: String, required: true },
    message: { type: String, required: true },
    runId: { type: String, required: true },
    employeeId: String,
    field: String,
    severity: { type: String, enum: ["blocking", "warning"], required: true },
    remediation: { type: String, required: true },
  }],
  totals: {
    grossPay: { type: Number, required: true, min: 0, default: 0 },
    deductions: { type: Number, required: true, min: 0, default: 0 },
    netPay: { type: Number, required: true, min: 0, default: 0 },
  },
  createdBy: { type: String, required: true }, reviewedBy: String, rejectedBy: String, rejectionReason: String, approvedBy: String, closedBy: String, closedAt: Date,
}, { timestamps: true, optimisticConcurrency: true, versionKey: "version" });
schema.index({ companyCode: 1, branchId: 1, startDate: 1, endDate: 1, type: 1 });
export const PayrollRunModel = model<PayrollRunDocument>("PayrollRun", schema);
