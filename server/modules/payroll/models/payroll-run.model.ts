import { Schema, model } from "mongoose";
import type { IPayrollRun } from "../interfaces/payroll-period.interface";

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
  effectiveSnapshot?: any;
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
  effectiveSnapshot: { type: Schema.Types.Mixed },
  supplementalReason: String,
  status: { type: String, enum: ["draft", "review", "closed", "paid"], default: "draft", index: true },
  needsInputRefresh: { type: Boolean, default: false },
  // vietnam giữ nguyên khối bảo hiểm/thuế; thiếu khai báo ở đây Mongoose sẽ cắt bỏ
  // và bảng lương mất toàn bộ chi tiết khấu trừ.
  lines: [{
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    calculation: { type: Schema.Types.Mixed, required: true },
    vietnam: { type: Schema.Types.Mixed },
    formulaVersion: { type: String },
    policyId: String,
    policyVersion: Number,
    policyCode: String,
    policyName: String,
    warnings: { type: [String], default: [] },
    formulaApplications: { type: Schema.Types.Mixed },
    periodInput: { type: Schema.Types.Mixed },
    payment: { type: Schema.Types.Mixed },
  }],
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
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: "version",
  minimize: false,
});
schema.index({ companyCode: 1, branchId: 1, startDate: 1, endDate: 1, type: 1 });
export const PayrollRunModel = model<PayrollRunDocument>("PayrollRun", schema);
