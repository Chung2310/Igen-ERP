import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type StudentStatus = 'Chờ KSK' | 'Đã KSK' | 'Đã nộp HS' | 'Đang học' | 'Đang thi' | 'Đã đậu' | 'Thi lại' | 'Nghỉ học' | 'Nợ học phí';

export interface IInstallmentStatus {
  installmentNo: number;     // Số thứ tự đợt (1, 2, 3...)
  percent: number;           // % học phí gốc của đợt này
  amountDue: number;         // Số tiền phải đóng (tính tại lúc gửi TB)
  status: 'Đã gửi' | 'Đã thu' | 'Chưa gửi';
  sentAt?: string;           // ISO date string khi gửi TB
  paidAt?: string;           // ISO date string khi xác nhận thu
  notificationId?: string;   // Ref đến Notification._id
}

export interface IHealthCheckFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: Date | string;
}

export interface IUploadedFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: Date | string;
}

export interface IStudentProgress {
  theory: { completed: boolean; score?: number; lastDate?: string };
  practice: { hoursDone: number; totalHours: number };
  cabin: { hoursDone: number; totalHours: number };
  dat: { kmDone: number; totalKm: number };
  sim: { completed: boolean; lastDate?: string };
}

export interface IStudentExam {
  id: string;
  name: string;
  date: string;
  type: 'Tốt nghiệp' | 'Sát hạch';
  status: 'Sắp thi' | 'Đã thi';
  result?: {
    theory: number | 'Đạt' | 'Không đạt';
    practice: number | 'Đạt' | 'Không đạt';
    simulation?: number | 'Đạt' | 'Không đạt';
    overall: 'Đậu' | 'Trượt' | 'Chưa có';
  };
}

export interface IStudentPayment {
  id: string;
  amount: number;
  date: string;
  method: 'Tiền mặt' | 'Chuyển khoản';
  note?: string;
  recipient: string;
}

export interface IStudentFaceEnrollment {
  registered: boolean;
  registeredAt?: Date;
  /** "student:<ownerId>:<studentId>" — namespace riêng, không trùng userId nhân viên trong InsightFace. */
  insightFaceUserId?: string;
  lastEvidencePublicId?: string;
}

export interface IStudent extends Document {
  customFields?: CustomFieldValues;
  fullName: string;
  slug?: string;
  email?: string;
  phone: string;
  referral?: string;
  birthday: string;
  idCard: string;
  /** Hạng bằng lái — thông tin riêng ngành lái xe, học viên ngành khác để trống */
  rank?: string;
  courseId?: string;
  registrationDate: string;
  enrollmentDate?: string;
  fee: string;
  paidAmount?: number;
  address: string;
  status: StudentStatus[];
  ownerId: string;
  centerId?: string;
  healthCheckDate?: string;
  healthCheckNotes?: string;
  healthCheckFiles?: IHealthCheckFile[];
  idCardFrontFile?: IUploadedFile;
  idCardBackFile?: IUploadedFile;
  portraitFile?: IUploadedFile;
  progress?: IStudentProgress;
  exams?: IStudentExam[];
  paymentHistory?: IStudentPayment[];
  installmentStatus?: IInstallmentStatus[];
  examId?: string;
  examName?: string;
  examDate?: string;
  idCardFront?: string;
  idCardBack?: string;
  partnerId?: string;
  faceEnrollment?: IStudentFaceEnrollment;
  createdAt?: Date;
  updatedAt?: Date;
}
