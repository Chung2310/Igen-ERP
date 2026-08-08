import { Document } from "mongoose";

export type StudentDeviceStatus = "active" | "revoked";

export interface IStudentDevice extends Document {
  credentialId: string;
  credentialHash: string;
  ownerId: string;
  studentId: string;
  branchId?: string;
  status: StudentDeviceStatus;
  registeredBatchId: string;
  registeredAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  userAgentHash?: string;
  fingerprintHash?: string;
  revokedAt?: Date;
  revokedReason?: string;
}
