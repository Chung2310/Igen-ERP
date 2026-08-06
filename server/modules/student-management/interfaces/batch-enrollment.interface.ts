import { Document } from "mongoose";

/**
 * Trạng thái học của một đăng ký. Module 3 chỉ dùng "Đang học";
 * các giá trị còn lại là chỗ cắm sẵn cho luồng bảo lưu/học lại (Module 5).
 */
export type BatchEnrollmentStatus =
  | "Đang học"
  | "Bảo lưu"
  | "Chờ xếp học lại"
  | "Học lại"
  | "Hoàn thành khóa"
  | "Chờ xếp lớp tiếp theo"
  | "Không còn nhu cầu học";

export interface IBatchRetakeEntry { count: number; batchId: string; reason: string; fee: number; at: Date; actorId?: string; }

export interface IBatchEnrollmentHistoryEntry {
  at: Date;
  action: string;
  fromStatus?: BatchEnrollmentStatus;
  toStatus?: BatchEnrollmentStatus;
  actorId?: string;
  note?: string;
}

export interface IBatchEnrollment extends Document {
  ownerId: string;
  branchId?: string;
  batchId: string;
  studentId: string;
  /** Tổng số buổi học viên được học trong lớp này */
  allowedSessions: number;
  /** Số buổi đã điểm danh có mặt (present hoặc late) */
  attendedSessions: number;
  /** Virtual: allowedSessions - attendedSessions, không âm */
  remainingSessions: number;
  status: BatchEnrollmentStatus;
  joinedAt: Date;
  leftAt?: Date | null;
  /** Mốc bắt đầu bảo lưu; không làm thay đổi sổ buổi. */
  suspendedAt?: Date | null;
  suspensionReason?: string;
  expectedReturnAt?: string | null;
  /** Lien ket voi Module lo trinh; de trong voi enrollment da co truoc Module 7. */
  roadmapId?: string;
  roadmapStepId?: string;
  sourceEnrollmentId?: string;
  enrollmentReason?: "initial" | "promotion" | "repeat" | "resume" | "manual";
  history: IBatchEnrollmentHistoryEntry[];
  retakeCount: number;
  retakeHistory: IBatchRetakeEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}
