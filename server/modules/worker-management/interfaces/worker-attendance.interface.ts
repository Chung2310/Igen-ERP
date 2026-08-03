import { Document, Types } from "mongoose";

/** Một mốc chấm công (vào hoặc ra) kèm bằng chứng vị trí tại thời điểm bấm. */
export interface IWorkerAttendanceMark {
  time: Date;
  latitude?: number;
  longitude?: number;
  /** Khoảng cách tới tâm dự án lúc bấm, mét. Rỗng khi dự án chưa đặt vị trí. */
  distanceMeters?: number;
  deviceInfo?: string;
  ipAddress?: string;
  /** Quản lý bấm hộ thay vì lao động tự điểm danh */
  recordedBy?: string;
}

export type WorkerAttendanceStatus =
  | "present"
  | "late"
  | "left-early"
  | "late-left-early"
  | "missing-checkout";

/**
 * Chấm công lao động theo từng dự án: mỗi lao động một bản ghi mỗi ngày mỗi dự án.
 */
export interface IWorkerAttendanceLog extends Document {
  workerId: Types.ObjectId;
  projectId: Types.ObjectId;
  companyCode: string;
  branchId?: Types.ObjectId;
  /** YYYY-MM-DD theo giờ Việt Nam */
  date: string;
  checkIn?: IWorkerAttendanceMark | null;
  checkOut?: IWorkerAttendanceMark | null;
  status: WorkerAttendanceStatus;
  /** Số phút làm việc giữa hai mốc; rỗng khi chưa có giờ về */
  workedMinutes?: number;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
