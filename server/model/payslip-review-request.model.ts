import { Schema, model } from "mongoose";

export type PayslipReviewRequestStatus = "open" | "resolved";

export interface PayslipReviewRequestDocument {
  companyCode: string;
  branchId: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  periodKey: string;
  revisionChecksum: string;
  message: string;
  status: PayslipReviewRequestStatus;
  response?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<PayslipReviewRequestDocument>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  runId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String, required: true },
  periodKey: { type: String, required: true },
  revisionChecksum: { type: String, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ["open", "resolved"], required: true, default: "open" },
  response: { type: String, maxlength: 4000 },
  resolvedBy: String,
  resolvedAt: Date,
}, { timestamps: true });

schema.index(
  { companyCode: 1, branchId: 1, runId: 1, employeeId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

export const PayslipReviewRequestModel = model<PayslipReviewRequestDocument>("PayslipReviewRequest", schema);
