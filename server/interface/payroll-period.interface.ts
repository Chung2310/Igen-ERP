import type { Document } from "mongoose";

export type PayrollPeriodStatus = "draft" | "attendance_locked" | "calculated" | "approved" | "closed";

export interface IAttendancePeriodResult extends Document {
  companyCode: string;
  periodKey: string;
  employeeId: string;
  employeeName?: string;
  monthlySalary: number;
  standardHours: number;
  standardDays: number;
  workedMinutes: number;
  shortageMinutes: number;
  workedDays?: number;
  shortageDays?: number;
  paidLeaveMinutesByRate: { minutes: number; payRate: number }[];
  overtime: { minutes: number; category: "weekday" | "restDay" | "holiday" }[];
  status: "draft" | "locked";
  lockedAt?: Date;
  lockedBy?: string;
}

export interface IPayrollRun extends Document {
  companyCode: string;
  periodKey: string;
  status: PayrollPeriodStatus;
  lines: { employeeId: string; employeeName?: string; calculation: Record<string, number> }[];
  createdBy: string;
  approvedBy?: string;
  closedBy?: string;
  closedAt?: Date;
}
