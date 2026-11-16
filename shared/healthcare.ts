export const visitStatuses = ["registered", "in_progress", "completed", "cancelled", "imported"] as const;
export const appointmentStatuses = ["scheduled", "confirmed", "arrived", "completed", "cancelled", "no_show"] as const;
export const careStatuses = ["open", "in_progress", "completed", "cancelled"] as const;
export const catalogKinds = ["doctor", "room", "service"] as const;

export type VisitStatus = typeof visitStatuses[number];
export type AppointmentStatus = typeof appointmentStatuses[number];
export type CareStatus = typeof careStatuses[number];
export type CatalogKind = typeof catalogKinds[number];
export type ImportKind = "patients" | "visits" | "hospital-report";
export const maxHospitalReportRows = 10_000;

export const hospitalReportColumns = {
  stt: "STT", so_phieu: "Số phiếu", ngay_gio_kham: "Ngày giờ khám", ma_phieu: "Mã phiếu",
  ten_benh_nhan: "Tên bệnh nhân", ma_benh_nhan: "Mã bệnh nhân", kieu: "Kiểu", doi_tuong_kham: "Đối tượng khám",
  phong_ban: "Phòng ban", gioi_tinh: "Giới tính", ngay_sinh: "Ngày sinh", tuoi: "Tuổi",
  so_dien_thoai: "Số điện thoại", dia_chi: "Địa chỉ", ly_do_vao_vien: "Lý do vào viện", trieu_chung: "Triệu chứng",
  chan_doan: "Chẩn đoán", phuong_phap_dieu_tri: "Phương pháp điều trị", dich_vu_dieu_tri: "Dịch vụ điều trị",
  ngay_hen_tai_kham: "Ngày hẹn tái khám", bac_si: "Bác sĩ", trang_thai: "Trạng thái",
  thanh_toan: "Thanh toán", ke_don: "Kê đơn", mua_thuoc: "Mua thuốc",
} as const;
export type HospitalReportFields = Record<keyof typeof hospitalReportColumns, string>;

export interface HealthcareRecord {
  _id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  source?: { batchId: string; row: number; sheet?: string };
}

export interface Patient extends HealthcareRecord {
  customerId?: string;
  code: string;
  name: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  note: string;
  hospitalProfile?: { gender: string; birthYear?: string; phoneText: string };
}

export interface Visit extends HealthcareRecord {
  code: string;
  patientId: string;
  visitedOn: string;
  doctorId: string;
  doctorName?: string;
  roomId: string;
  serviceId: string;
  status: VisitStatus;
  paymentNote: string;
  note: string;
  report?: {
    visitedAt: string;
    department: string;
    doctor: string;
    service?: string;
    sourceStatus: string;
    followUpOn: string;
    fields?: HospitalReportFields;
  };
}

export interface Appointment extends HealthcareRecord {
  patientId: string;
  visitId: string;
  doctorId: string;
  doctorName?: string;
  roomId: string;
  /** Local calendar date; supports imported follow-up dates that have no time. */
  scheduledOn?: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  note: string;
}

export interface CareTask extends HealthcareRecord {
  patientId: string;
  appointmentId: string;
  visitId?: string;
  assigneeId?: string;
  title: string;
  details?: string;
  dueOn: string;
  status: CareStatus;
  result: string;
}

export interface CatalogItem extends HealthcareRecord {
  kind: CatalogKind;
  code: string;
  name: string;
  active: boolean;
}

export type RecordInput<T extends HealthcareRecord> = Omit<T, keyof HealthcareRecord>;
export type HealthcareList<T> = { items: T[]; total: number; page: number; pageSize: number };
export type HealthcareStaff = { _id: string; name: string };
export type PatientReference = Pick<Patient, "_id" | "code" | "name"> & Partial<Pick<Patient, "phone">>;
export type HealthcarePatientList<T> = HealthcareList<T> & { patientReferences: PatientReference[] };
export type HealthcareOverview = {
  today: string;
  patients: number;
  visitCount: number | null;
  appointmentCount: number | null;
  careCount: number | null;
  todayAppointments: Pick<Appointment, "_id" | "patientId" | "scheduledOn" | "startsAt" | "status">[];
  dueCare: Pick<CareTask, "_id" | "patientId" | "dueOn" | "title">[];
  patientReferences: PatientReference[];
};

export type ImportJobStatus = "queued" | "running" | "preview" | "completed" | "failed";
export type ImportRowStatus = "ready" | "imported" | "skipped" | "invalid";

export interface ImportJob {
  _id: string;
  kind: ImportKind;
  filename: string;
  status: ImportJobStatus;
  phase: "check" | "write";
  total: number;
  ready: number;
  processed: number;
  duplicates: number;
  invalid: number;
  patientsReady?: number;
  inserted?: number;
  patientsInserted?: number;
  appointmentsInserted?: number;
  careInserted?: number;
  skipped?: number;
  createdAt?: string;
  completedAt?: string;
  retryable?: boolean;
  error?: string;
}

export interface ImportRowResult {
  index: number;
  row: number;
  sheet?: string;
  code: string;
  label: string;
  status: ImportRowStatus;
  message?: string;
  preview?: Record<string, string>;
  recordId?: string;
}
