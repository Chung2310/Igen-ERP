import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type BatchStatus = 'Sắp khai giảng' | 'Đang học' | 'Đã kết thúc';

export interface IBatch extends Document {
  customFields?: CustomFieldValues;
  code: string;
  courseId: string;
  instructorId?: string;
  learnerIds: string[];
  daysOfWeek: number[]; // 0 = Chủ nhật ... 6 = Thứ 7
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  location?: string;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  status: BatchStatus;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
