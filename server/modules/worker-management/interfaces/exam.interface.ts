import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type ExamStatus =
  | "Sắp diễn ra"
  | "Đã xác nhận"
  | "Đã hoàn thành"
  | "Đã hủy";

export interface IExam extends Document {
  customFields?: CustomFieldValues;
  name: string;
  status: ExamStatus;
  /** Hạng bằng lái — riêng ngành lái xe, kỳ thi ngành khác để trống */
  rank?: string;
  tentativeDate: string;
  officialDate?: string;
  location: string;
  studentCount: number;
  passCount: number;
  failCount: number;
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
