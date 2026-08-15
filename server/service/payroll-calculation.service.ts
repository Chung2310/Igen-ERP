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

function assertRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`);
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  assertNonNegative("monthlySalary", input.monthlySalary);
  assertNonNegative("standardHours", input.standardHours);
  assertNonNegative("workedMinutes", input.workedMinutes);
  assertNonNegative("shortageMinutes", input.shortageMinutes);
  assertNonNegative("standardDays", input.standardDays);
  assertNonNegative("allowances", input.allowances);
  assertNonNegative("bonuses", input.bonuses);
  assertNonNegative("deductions", input.deductions);
  if (!Number.isFinite(input.adjustments)) throw new Error("adjustments must be a finite number");
  input.paidLeaveMinutesByRate.forEach((leave, index) => {
    assertNonNegative(`paidLeaveMinutesByRate[${index}].minutes`, leave.minutes);
    assertRate(`paidLeaveMinutesByRate[${index}].payRate`, leave.payRate);
  });
  input.overtime.forEach((item, index) => {
    assertNonNegative(`overtime[${index}].minutes`, item.minutes);
    if (!(item.category in OVERTIME_MULTIPLIERS)) throw new Error(`overtime[${index}].category is invalid`);
  });
  if (input.standardHours === 0) throw new Error("standardHours must be greater than zero");

  const hourlyRate = input.monthlySalary / input.standardHours;
  
  // Số tiền nghỉ phép được hưởng
  const paidLeaveValue = input.paidLeaveMinutesByRate.reduce(
    (total, leave) => total + money((leave.minutes / 60) * hourlyRate * leave.payRate),
    0,
  );

  const standardMinutes = input.standardHours * 60;
  const regularWorkedValue = (Math.min(input.workedMinutes, standardMinutes) / 60) * hourlyRate;
  const basePay = Math.min(input.monthlySalary, Math.max(0, money(regularWorkedValue + paidLeaveValue)));
  const commission = Math.max(0, money(input.commission ?? 0));
  const adjustedBase = basePay + commission;
  const shortageValue = Math.max(0, input.monthlySalary - basePay);
  const overtime = input.overtime.reduce(
    (total, item) => total + money((item.minutes / 60) * hourlyRate * OVERTIME_MULTIPLIERS[item.category]),
    0,
  );
  const gross = Math.max(0, money(adjustedBase + overtime + input.allowances + input.bonuses + Math.max(input.adjustments, 0)));
  const net = Math.max(0, money(gross - input.deductions - Math.max(-input.adjustments, 0)));

  return { hourlyRate, shortageValue, paidLeaveValue, adjustedBase, overtime, gross, net };
}
