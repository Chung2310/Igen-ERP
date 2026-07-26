export type OvertimeCategory = "weekday" | "restDay" | "holiday";

export interface PaidLeaveMinutes {
  minutes: number;
  payRate: number;
}

export interface OvertimeMinutes {
  minutes: number;
  category: OvertimeCategory;
}

export interface PayrollCalculationInput {
  monthlySalary: number;
  standardDays: number;
  standardHours: number;
  workedMinutes: number;
  shortageMinutes: number;
  paidLeaveMinutesByRate: PaidLeaveMinutes[];
  overtime: OvertimeMinutes[];
  allowances: number;
  bonuses: number;
  deductions: number;
  adjustments: number;
}

export interface PayrollCalculationResult {
  hourlyRate: number;
  shortageValue: number;
  paidLeaveValue: number;
  adjustedBase: number;
  overtime: number;
  gross: number;
  net: number;
}
