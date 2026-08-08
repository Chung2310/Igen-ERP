import { Schema, model } from "mongoose";
import type { IWorkerDevice } from "../interfaces/worker-device.interface";

const workerDeviceSchema = new Schema<IWorkerDevice>(
  {
    credentialId: { type: String, required: true, unique: true, index: true },
    credentialHash: { type: String, required: true },
    companyCode: { type: String, required: true, index: true },
    workerId: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    registeredAt: { type: Date, required: true, default: Date.now },
    lastUsedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    userAgentHash: { type: String, default: "" },
    fingerprintHash: { type: String, default: "" },
    revokedAt: { type: Date },
    revokedReason: { type: String, default: "" },
  },
  { versionKey: false }
);

workerDeviceSchema.index({ companyCode: 1, workerId: 1, status: 1, lastUsedAt: -1 });

export const WorkerDeviceModel = model<IWorkerDevice>("WorkerDevice", workerDeviceSchema);
