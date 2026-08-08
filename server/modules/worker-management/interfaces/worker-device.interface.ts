import { Document } from "mongoose";

export type WorkerDeviceStatus = "active" | "revoked";

export interface IWorkerDevice extends Document {
  credentialId: string;
  credentialHash: string;
  companyCode: string;
  workerId: string;
  status: WorkerDeviceStatus;
  registeredAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  userAgentHash?: string;
  fingerprintHash?: string;
  revokedAt?: Date;
  revokedReason?: string;
}
