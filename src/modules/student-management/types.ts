/**
 * Student Types
 */

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export type StudentStatus = 'Chờ KSK' | 'Đã KSK' | 'Đã nộp HS' | 'Đang học' | 'Đang thi' | 'Đã đậu' | 'Thi lại' | 'Nghỉ học' | 'Nợ học phí';

export interface DrivingStudent {
  id: string;
  fullName: string;
  slug?: string;
  email?: string;
  phone: string;
  referral?: string;
  birthday: string;
  idCard: string;
  idCardFront?: string;
  idCardBack?: string;
  /** Hạng bằng lái — thông tin riêng ngành lái xe, học viên ngành khác để trống */
  rank?: string;
  courseId?: string;
  registrationDate: string;
  enrollmentDate?: string;
  fee: string; // This is the TOTAL fee string (e.g. "12,000,000")
  paidAmount?: number; // Total amount paid so far
  address: string;
  status: StudentStatus[];
  ownerId: string;
  centerId?: string;
  partnerId?: string;
  healthCheckDate?: string;
  healthCheckNotes?: string;
  healthCheckFiles?: UploadedFile[];
  idCardFrontFile?: UploadedFile;
  idCardBackFile?: UploadedFile;
  portraitFile?: UploadedFile;
  
  // Progress tracking
  progress?: {
    theory: { completed: boolean; score?: number; lastDate?: string };
    practice: { hoursDone: number; totalHours: number };
    cabin: { hoursDone: number; totalHours: number };
    dat: { kmDone: number; totalKm: number };
    sim: { completed: boolean; lastDate?: string };
  };

  // Exam History
  exams?: {
    id: string;
    name: string;
    date: string;
    type: 'Tốt nghiệp' | 'Sát hạch';
    status: 'Sắp thi' | 'Đã thi';
    result?: {
      theory: number | 'Đạt' | 'Không đạt';
      practice: number | 'Đạt' | 'Không đạt';
      simulation?: number | 'Đạt' | 'Không đạt';
      overall: 'Đậu' | 'Trượt' | 'Chưa có' | 'Sắp thi' | 'Vắng thi';
    };
  }[];

  // Payment History (Detailed)
  paymentHistory?: {
    id: string;
    amount: number;
    date: string;
    method: 'Tiền mặt' | 'Chuyển khoản';
    note?: string;
    recipient: string;
  }[];

  createdAt?: Date | string;
  updatedAt?: Date | string;
  examId?: string;
  examName?: string;
  examDate?: string;
}

export interface FeePayment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  date: string;
  note?: string;
  ownerId: string;
  createdAt?: Date | string;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  content: string;
  recipients: string; // e.g. "Tất cả học viên đang học"
  recipientCount: number;
  channels: string[]; // ["Zalo OA", "SMS"]
  status: 'Đã gửi' | 'Đang gửi' | 'Thất bại';
  ownerId: string;
  createdAt: Date | string;
}

export interface RankSetting {
  id: string;
  rank: string;
  label: string;
  fee: string;
  modules: string[]; // ["Lý thuyết", "Thực hành", ...]
  ownerId: string;
}

export interface AreaSetting {
  id: string;
  name: string;
  studentCount?: number;
  ownerId: string;
}

export interface PaymentStage {
  id: string;
  name: string;
  order: number;
  ownerId: string;
}

export type Student = DrivingStudent;

export type ExamStatus = 'Sắp diễn ra' | 'Đã xác nhận' | 'Đã hoàn thành' | 'Đã hủy';

export interface ExamSession {
  id: string;
  name: string;
  status: ExamStatus;
  /** Hạng bằng lái — riêng ngành lái xe, kỳ thi ngành khác để trống */
  rank?: string;
  area?: string;
  tentativeDate: string;
  officialDate?: string;
  location: string;
  studentCount: number;
  passCount: number;
  failCount: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// ==== ERP: Khóa học / Giảng viên / Tài nguyên / Lịch tổng hợp ====

export type CourseCategory = string;
export type CourseStatus = 'Hoạt động' | 'Tạm dừng';

export interface Course {
  id: string;
  code: string;
  title: string;
  category: CourseCategory;
  fee: string;
  duration: string;
  maxLearners: number;
  activeBatches: number;
  status: CourseStatus;
  ownerId: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type ManagedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: 'superadmin' | 'admin' | 'user';
  centerId: string;
  createdBy?: string;
  isActive?: boolean;
  bankAccountNo?: string;
  bankId?: string;
  businessType?: 'driving' | 'language' | 'general';
  maxUsersLimit?: number;
  permissions?: string[];
};

export type BatchStatus = 'Sắp khai giảng' | 'Đang học' | 'Đã kết thúc';

export interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'excused';
}

export interface AttendanceSession {
  _id: string;
  date: string;
  note?: string;
  records: AttendanceRecord[];
}

export interface Batch {
  id: string;
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
  attendanceSessions?: AttendanceSession[];
  // Thông tin server gắn kèm để hiển thị
  courseCode: string;
  courseTitle: string;
  maxLearners: number;
  instructorName: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Phân loại tài nguyên là chuỗi động (quản lý qua /resources/categories);
// các giá trị cũ 'ROOM' | 'VEHICLE' | 'EQUIPMENT' vẫn hợp lệ với dữ liệu đã có.
export type ResourceType = string;
export type ResourceStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

export interface ResourceBooking {
  id?: string;
  purpose: string;
  by: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface ResourceItem {
  id: string;
  name: string;
  type: ResourceType;
  identifier: string;
  capacity: string;
  status: ResourceStatus;
  bookings: ResourceBooking[];
  ownerId: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  type: 'class' | 'exam' | 'resource';
  date: string; // YYYY-MM-DD
  time: string;
  details: string;
}

export interface StudentStats {
  totalStudents: number;
  averageGPA: number;
  attendanceRate: number;
  atRiskCount: number;
}

export interface PartnerPayout {
  id: string;
  amount: number;
  date: string;
  method: string;
  note?: string;
}

export interface PartnerReferredStudent {
  _id: string;
  fullName: string;
  phone: string;
  registrationDate: string;
  status: string[];
  commission: number;
}

export interface Partner {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  isActive: boolean;
  notes?: string;
  ownerId: string;
  referredStudentsCount: number;
  totalCommission: number;
  totalPaid: number;
  unpaidBalance: number;
  referredStudents: PartnerReferredStudent[];
  payoutHistory: PartnerPayout[];
  levelName?: string;
  totalReferredTuition?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommissionLevel {
  _id: string;
  name: string;
  minTuition: number;
  commissionRate: number;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}
