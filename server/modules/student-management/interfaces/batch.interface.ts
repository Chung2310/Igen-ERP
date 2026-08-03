import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type BatchStatus = 'Sắp khai giảng' | 'Đang học' | 'Đã kết thúc';

export interface IAttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "excused";
}

export interface IAttendanceSession {
  id: string;
  date: string;
  note?: string;
  records: IAttendanceRecord[];
}

export interface IBatchGeoLocation {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

export interface IBatch extends Document {
  customFields?: CustomFieldValues;
  code: string;
  /** Tên hiển thị (dự án tuyển dụng) — thay cho danh mục ở preset lao động */
  name?: string;
  /** Chỉ tiêu riêng của dự án. 0 = dùng chỉ tiêu của khóa học/danh mục. */
  quota?: number;
  courseId: string;
  instructorId?: string;
  /** Tên người phụ trách nhập tay khi không gán tài khoản trong công ty */
  instructorText?: string;
  learnerIds: string[];
  daysOfWeek: number[]; // 0 = Chủ nhật ... 6 = Thứ 7
  startTime: string;    // HH:mm
  endTime: string;      // HH:mm
  location?: string;
  geoLocation?: IBatchGeoLocation;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  status: BatchStatus;
  ownerId: string;
  branchId?: string;
  attendanceSessions: IAttendanceSession[];
  createdAt?: Date;
  updatedAt?: Date;
}
