import { Document } from "mongoose";

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

export interface IBatch extends Document {
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
  attendanceSessions: IAttendanceSession[];
  createdAt?: Date;
  updatedAt?: Date;
}
