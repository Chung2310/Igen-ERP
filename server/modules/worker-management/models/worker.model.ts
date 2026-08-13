import mongoose, { Schema, type Model } from "mongoose";
import { WORKER_LABOR_TYPES, type IWorker } from "../interfaces/worker.interface";

const workerSchema = new Schema<IWorker>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ["active", "inactive", "placed"], default: "active", required: true },
  laborType: { type: String, enum: WORKER_LABOR_TYPES, default: "official" },
  nationality: { type: String, trim: true },
  workPermitNumber: { type: String, trim: true },
  workPermitExpiry: { type: String, trim: true },
  note: { type: String, trim: true },
  address: { type: String, trim: true },
  birthday: { type: String, trim: true },
  idCard: { type: String, trim: true },
  registrationDate: { type: String, trim: true },
  customFields: { type: Schema.Types.Mixed, default: {} },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

workerSchema.index({ companyCode: 1, branchId: 1, deletedAt: 1 });
workerSchema.index({ fullName: "text", phone: "text" });

export const WorkerModel: Model<IWorker> = (mongoose.models.Worker as Model<IWorker> | undefined)
  || mongoose.model<IWorker>("Worker", workerSchema);