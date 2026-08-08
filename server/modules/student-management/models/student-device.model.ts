import { Schema, model } from "mongoose";
import { IStudentDevice } from "../interfaces/student-device.interface";

const studentDeviceSchema = new Schema<IStudentDevice>(
  {
    credentialId: { type: String, required: true, unique: true, index: true },
    credentialHash: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    branchId: { type: String, default: "", index: true },
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    registeredBatchId: { type: String, required: true, index: true },
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

studentDeviceSchema.index({ ownerId: 1, studentId: 1, status: 1, lastUsedAt: -1 });

export const StudentDeviceModel = model<IStudentDevice>("StudentDevice", studentDeviceSchema);
