import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type ExamStatus = 'Sắp diễn ra' | 'Đã xác nhận' | 'Đã hoàn thành' | 'Đã hủy';

export interface IExam extends Document {
  customFields?: CustomFieldValues;
  name: string;
  status: ExamStatus;
  /** Hạng bằng lái — riêng ngành lái xe, kỳ thi ngành khác để trống */
  rank?: string;
  tentativeDate: string;
  officialDate?: string;
  location: string;
  /** Lớp học sở hữu kỳ thi; để trống chỉ cho dữ liệu kỳ thi cũ. */
  batchId?: string;
  maxScore?: number;
  /** Điểm tối thiểu để được tính là đạt. */
  passScore?: number;
  results?: Array<{ studentId: string; score?: number; outcome?: "Đậu" | "Trượt" | "Chưa có"; note?: string; gradedBy?: string; gradedAt?: Date }>;
  studentCount: number;
  passCount: number;
  failCount: number;
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
