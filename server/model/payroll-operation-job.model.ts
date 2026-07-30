import { Schema, model } from "mongoose";

interface PayrollOperationJobDocument {
  companyCode: string;
  branchId: string;
  runId?: string;
  idempotencyKey: string;
  operation: string;
  status: "queued" | "running" | "succeeded" | "failed";
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<PayrollOperationJobDocument>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  runId: { type: String, index: true },
  idempotencyKey: { type: String, required: true },
  operation: { type: String, required: true },
  status: { type: String, enum: ["queued", "running", "succeeded", "failed"], required: true, default: "queued", index: true },
  payload: Schema.Types.Mixed,
  result: Schema.Types.Mixed,
  error: {
    code: String,
    message: String,
  },
}, { timestamps: true });

schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });

export const PayrollOperationJobModel = model<PayrollOperationJobDocument>("PayrollOperationJob", schema);
