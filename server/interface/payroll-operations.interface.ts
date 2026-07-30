export type PayrollRunStatus =
  | "draft"
  | "attendance_locked"
  | "calculated"
  | "reviewed"
  | "approved"
  | "closed"
  | "partially_paid"
  | "paid";

export type PayrollRunType = "regular" | "supplemental";

export type PayrollIssueSeverity = "blocking" | "warning";

export interface PayrollIssue {
  code: string;
  message: string;
  runId: string;
  employeeId?: string;
  field?: string;
  severity: PayrollIssueSeverity;
  remediation: string;
}

export interface PayrollAttendanceEmployeeSnapshot {
  employeeId: string;
  employeeName?: string;
  standardHours: number;
  standardDays: number;
  workedMinutes: number;
  shortageMinutes: number;
  paidLeaveMinutesByRate: { minutes: number; payRate: number }[];
  overtime: { minutes: number; category: "weekday" | "restDay" | "holiday" }[];
  sourceResultId?: string;
  sourceVersion?: number;
}

export interface PayrollAttendanceSnapshot {
  companyCode: string;
  branchId?: string;
  runId: string;
  periodKey: string;
  employees: PayrollAttendanceEmployeeSnapshot[];
  lockedAt: Date;
  lockedBy: string;
}
