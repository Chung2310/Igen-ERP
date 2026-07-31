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
  readonly employeeId: string;
  readonly employeeName?: string;
  readonly standardHours: number;
  readonly standardDays: number;
  readonly workedMinutes: number;
  readonly shortageMinutes: number;
  readonly paidLeaveMinutesByRate: readonly { readonly minutes: number; readonly payRate: number }[];
  readonly overtime: readonly { readonly minutes: number; readonly category: "weekday" | "restDay" | "holiday"; readonly night?: boolean }[];
  readonly sourceResultId?: string;
  readonly sourceVersion?: number;
}

export interface PayrollAttendanceSnapshot {
  readonly companyCode: string;
  readonly branchId: string;
  readonly runId: string;
  readonly periodKey: string;
  readonly employees: readonly PayrollAttendanceEmployeeSnapshot[];
  /** ISO-8601 UTC timestamp. */
  readonly lockedAt: string;
  readonly lockedBy: string;
}
