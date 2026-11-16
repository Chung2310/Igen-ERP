import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";
import type { StudentStatus } from "../../../../shared/student-status";

export type { StudentStatus } from "../../../../shared/student-status";

export interface IInstallmentStatus {
  installmentNo: number;     // Số thứ tự đợt (1, 2, 3...)
  percent: number;           // % học phí gốc của đợt này
  amountDue: number;         // Số tiền phải đóng (tính tại lúc gửi TB)
  status: 'Đã gửi' | 'Đã thu' | 'Chưa gửi';
  sentAt?: string;           // ISO date string khi gửi TB
  dueAt?: Date | string;     // Ngày đến hạn thực tế
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
  batchId?: string;
  courseId?: string;
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
  customerId?: string;
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
  /** Các khóa học học viên đã hoàn thành theo kết quả thi. */
  completedCourseIds?: string[];
  registrationDate: string;
  enrollmentDate?: string;
  fee: string;
  /** Set when an explicit Excel tuition value of 0 means the learner studies for free. */
  tuitionWaived?: boolean;
  paidAmount?: number;
  address: string;
  status: StudentStatus[];
  ownerId: string;
  /** UID người thực sự tạo bản ghi — rỗng với dữ liệu tạo trước khi có trường này */
  createdBy?: string;
  createdByName?: string;
  branchId?: string;
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
