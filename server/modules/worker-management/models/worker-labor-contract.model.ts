import { Schema, model } from "mongoose";
import {
  IWorkerLaborContract,
  WORKER_LABOR_CONTRACT_STATUSES,
} from "../interfaces/worker-labor-contract.interface";

const WorkerLaborContractSchema = new Schema<IWorkerLaborContract>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
    code: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: {
      type: String,
      enum: WORKER_LABOR_CONTRACT_STATUSES,
      default: "draft",
      index: true,
    },
    note: { type: String },
    rootContractId: { type: Schema.Types.ObjectId, index: true },
    previousContractId: { type: Schema.Types.ObjectId, default: null },
    sequence: { type: Number, default: 1 },
    previousEndDate: { type: String },
    renewedAt: { type: Date, default: null },
    renewedBy: { type: String },
    lockedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

// Mã hợp đồng là duy nhất trong một công ty, bỏ qua bản ghi đã xóa mềm.
WorkerLaborContractSchema.index(
  { companyCode: 1, code: 1, deletedAt: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Phục vụ truy vấn hợp đồng sắp/đã hết hạn.
WorkerLaborContractSchema.index({ companyCode: 1, status: 1, endDate: -1 });

export const WorkerLaborContractModel = model<IWorkerLaborContract>(
  "WorkerLaborContract",
  WorkerLaborContractSchema,
);
