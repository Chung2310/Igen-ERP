import mongoose, { Schema, type Model } from "mongoose";
import type { IWorker } from "../interfaces/worker.interface";

const workerSchema = new Schema<IWorker>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ["active", "inactive", "placed"], default: "active", required: true },
  note: { type: String, trim: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

workerSchema.index({ companyCode: 1, branchId: 1, deletedAt: 1 });
export const WorkerModel: Model<IWorker> = (mongoose.models.Worker as Model<IWorker> | undefined)
  || mongoose.model<IWorker>("Worker", workerSchema);
