export type WorkerStatus = "active" | "inactive" | "placed";

/** Loại lao động: chính thức, thời vụ, người nước ngoài. */
export type WorkerLaborType = "official" | "seasonal" | "foreign";

export const workerLaborTypeLabel: Record<WorkerLaborType, string> = {
  official: "Chính thức",
  seasonal: "Thời vụ",
  foreign: "Người nước ngoài",
};

/** Hợp đồng lao động — mỗi bản ghi là một kỳ trong chuỗi gia hạn. */
export type WorkerLaborContractStatus =
  | "draft"
  | "active"
  | "renewed"
  | "expired"
  | "terminated";

export const workerContractStatusLabel: Record<WorkerLaborContractStatus, string> = {
  draft: "Nháp",
  active: "Đang hiệu lực",
  renewed: "Đã gia hạn",
  expired: "Đã hết hạn",
  terminated: "Đã chấm dứt",
};

export type WorkerContractAlertLevel = "ok" | "expiring" | "expired";

export type WorkerLaborContract = {
  _id: string;
  workerId: string;
  code: string;
  clientName: string;
  startDate: string;
  endDate: string;
  status: WorkerLaborContractStatus;
  note?: string;
  rootContractId: string;
  previousContractId?: string | null;
  sequence: number;
  previousEndDate?: string;
  renewedAt?: string | null;
  renewedBy?: string;
  lockedAt?: string | null;
  alertLevel?: WorkerContractAlertLevel;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkerLaborContractInput = {
  workerId?: string;
  code: string;
  clientName: string;
  startDate: string;
  endDate: string;
  status?: WorkerLaborContractStatus;
  note?: string;
};

export type WorkerContractAlertSummary = {
  alertDays: number;
  expiringCount: number;
  expiredCount: number;
  items: WorkerLaborContract[];
};

export type WorkerScope = {
  companyCode: string;
  branchId?: string;
};

export type WorkerProfileFieldKey =
  | "fullName"
  | "phone"
  | "email"
  | "idCard"
  | "birthday"
  | "registrationDate"
  | "address"
  | "status"
  | "laborType"
  | "nationality"
  | "workPermitNumber"
  | "workPermitExpiry"
  | "note";

export type WorkerProfileFieldConfig = {
  key: WorkerProfileFieldKey;
  label: string;
  isRequired: boolean;
  isVisible: boolean;
  isArchived?: boolean;
};

export type WorkerProjectSummary = {
  id: string;
  name: string;
};

export type BulkWorkerInput = {
  fullName: string;
  phone: string;
  email?: string;
  idCard?: string;
  birthday?: string;
  address?: string;
  note?: string;
  registrationDate?: string;
  laborType?: WorkerLaborType;
  nationality?: string;
  workPermitNumber?: string;
  workPermitExpiry?: string;
};

export type WorkerBulkImportError = {
  row: number;
  name: string;
  phone: string;
  reason: string;
};

export type WorkerBulkImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: WorkerBulkImportError[];
};

export type Worker = {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: WorkerStatus;
  laborType?: WorkerLaborType;
  nationality?: string;
  workPermitNumber?: string;
  workPermitExpiry?: string;
  note?: string;
  branchId?: string;
  address?: string;
  birthday?: string;
  idCard?: string;
  registrationDate?: string;
  customFields?: Record<string, unknown>;
  projectIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type WorkerInput = Pick<
  Worker,
  | "fullName"
  | "phone"
  | "email"
  | "status"
  | "laborType"
  | "nationality"
  | "workPermitNumber"
  | "workPermitExpiry"
  | "note"
  | "branchId"
  | "address"
  | "birthday"
  | "idCard"
  | "registrationDate"
  | "customFields"
> & {
  projectId?: string;
};

export type WorkerProject = {
  _id: string;
  code: string;
  name: string;
  quota: number;
  workerIds: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location?: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "completed";
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkerProjectInput = Omit<WorkerProject, "_id" | "createdAt" | "updatedAt">;

export interface WorkerAttendanceMark {
  time: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  deviceInfo?: string;
  ipAddress?: string;
  recordedBy?: string;
}

export type WorkerAttendanceStatus =
  | "present"
  | "late"
  | "left-early"
  | "late-left-early"
  | "missing-checkout";

export interface WorkerAttendanceLog {
  _id: string;
  workerId: string;
  projectId: string;
  companyCode: string;
  branchId?: string;
  date: string;
  checkIn?: WorkerAttendanceMark | null;
  checkOut?: WorkerAttendanceMark | null;
  status: WorkerAttendanceStatus;
  workedMinutes?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}
