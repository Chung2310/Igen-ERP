import type { Types } from "mongoose";

export type WorkerStatus = "active" | "inactive" | "placed";

/** Loại lao động: chính thức, thời vụ, người nước ngoài. */
export type WorkerLaborType = "official" | "seasonal" | "foreign";

export const WORKER_LABOR_TYPES: WorkerLaborType[] = ["official", "seasonal", "foreign"];

export interface IWorker {
  _id?: Types.ObjectId;
  companyCode: string;
  branchId?: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: WorkerStatus;
  laborType?: WorkerLaborType;
  nationality?: string;
  /** Số giấy phép lao động / visa — chỉ dùng cho lao động nước ngoài. */
  workPermitNumber?: string;
  /** Ngày hết hạn giấy phép lao động / visa, định dạng DD/MM/YYYY. */
  workPermitExpiry?: string;
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