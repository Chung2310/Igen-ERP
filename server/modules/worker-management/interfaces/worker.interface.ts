import type { Types } from "mongoose";

export type WorkerStatus = "active" | "inactive" | "placed";

export interface IWorker {
  _id?: Types.ObjectId;
  companyCode: string;
  branchId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: WorkerStatus;
  note?: string;
  address?: string;
  birthday?: string;
  idCard?: string;
  registrationDate?: string;
  customFields?: Record<string, unknown>;
  deletedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}