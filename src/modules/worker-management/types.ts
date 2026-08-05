export type WorkerStatus = "active" | "inactive" | "placed";

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
  | "note";

export type WorkerProfileFieldConfig = {
  key: WorkerProfileFieldKey;
  label: string;
  isRequired: boolean;
  isVisible: boolean;
};

export type WorkerProjectSummary = {
  id: string;
  name: string;
};

export type Worker = {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: WorkerStatus;
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
