import type {
  OvertimeCategory,
  PayrollCalculationInput,
  PayrollCalculationResult,
} from "../interface/payroll.interface";

const OVERTIME_MULTIPLIERS: Record<OvertimeCategory, number> = {
  weekday: 1.5,
  restDay: 2,
  holiday: 3,
};

function money(value: number): number {
  return Math.round(value);
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  assertNonNegative("monthlySalary", input.monthlySalary);
  assertNonNegative("standardHours", input.standardHours);
  assertNonNegative("shortageMinutes", input.shortageMinutes);
  if (input.standardHours === 0) throw new Error("standardHours must be greater than zero");

  const hourlyRate = input.monthlySalary / input.standardHours;
  const shortageValue = money((input.shortageMinutes / 60) * hourlyRate);
  const paidLeaveValue = input.paidLeaveMinutesByRate.reduce(
    (total, leave) => total + money((leave.minutes / 60) * hourlyRate * leave.payRate),
    0,
  );
  const adjustedBase = money(input.monthlySalary - shortageValue + paidLeaveValue);
  const overtime = input.overtime.reduce(
    (total, item) => total + money((item.minutes / 60) * hourlyRate * OVERTIME_MULTIPLIERS[item.category]),
    0,
  );
  const gross = money(adjustedBase + overtime + input.allowances + input.bonuses + Math.max(input.adjustments, 0));
  const net = money(gross - input.deductions - Math.max(-input.adjustments, 0));

  return { hourlyRate, shortageValue, paidLeaveValue, adjustedBase, overtime, gross, net };
}
