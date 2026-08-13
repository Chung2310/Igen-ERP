import { Document, Types } from "mongoose";

/**
 * Hợp đồng lao động. Mỗi document là MỘT KỲ hợp đồng: gia hạn không sửa kỳ cũ
 * mà tạo kỳ mới nối vào chuỗi qua previousContractId/rootContractId.
 */
export type WorkerLaborContractStatus =
  | "draft"
  | "active"
  | "renewed"
  | "expired"
  | "terminated";

export const WORKER_LABOR_CONTRACT_STATUSES: WorkerLaborContractStatus[] = [
  "draft",
  "active",
  "renewed",
  "expired",
  "terminated",
];

/** Số ngày trước hạn bắt đầu cảnh báo. */
export const WORKER_CONTRACT_ALERT_DAYS = 30;

export type WorkerContractAlertLevel = "ok" | "expiring" | "expired";

export interface IWorkerLaborContract extends Document {
  companyCode: string;
  branchId?: Types.ObjectId;
  workerId: Types.ObjectId;
  code: string;
  clientName: string;
  /** Chuỗi YYYY-MM-DD, đồng bộ với worker-project. */
  startDate: string;
  endDate: string;
  status: WorkerLaborContractStatus;
  note?: string;
  rootContractId: Types.ObjectId;
  previousContractId?: Types.ObjectId | null;
  sequence: number;
  /** Ngày kết thúc của kỳ trước, chép sang khi gia hạn để giữ dấu vết. */
  previousEndDate?: string;
  renewedAt?: Date | null;
  renewedBy?: string;
  /** Khác null ⇒ kỳ đã đóng, cấm sửa ngày và điều khoản. */
  lockedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerLaborContractInput {
  workerId?: string;
  code?: string;
  clientName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  note?: string;
}
