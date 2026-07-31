type AttendanceDetails = {
  monthlySalary?: number;
  standardHours?: number;
  standardDays?: number;
  workedMinutes?: number;
  workedDays?: number;
  shortageMinutes?: number;
  shortageDays?: number;
  paidLeaveMinutesByRate?: { minutes: number; payRate: number }[];
  overtime?: { minutes: number; category: string }[];
};

type CalculationDetails = Record<string, any>;

export function buildPayrollDetails(attendance: AttendanceDetails = {}, calculation: CalculationDetails = {}) {
  const standardDays = Number(calculation.standardDays ?? attendance.standardDays ?? 0);
  const standardHours = Number(calculation.standardHours ?? attendance.standardHours ?? 0);
  const shortageMinutes = Number(calculation.shortageMinutes ?? attendance.shortageMinutes ?? 0);
  return {
    monthlySalary: Number(calculation.monthlySalary ?? attendance.monthlySalary ?? 0),
    standardHours,
    standardDays,
    workedMinutes: Number(calculation.workedMinutes ?? attendance.workedMinutes ?? 0),
    workedDays: Number(calculation.workedDays ?? attendance.workedDays ?? 0),
    shortageMinutes,
    shortageDays: Number(calculation.shortageDays ?? attendance.shortageDays ?? (standardDays && standardHours ? shortageMinutes / (standardHours * 60) : 0)),
    paidLeaveValue: Number(calculation.paidLeaveValue ?? 0),
    paidLeaveMinutesByRate: attendance.paidLeaveMinutesByRate ?? [],
    overtimeValue: Number(calculation.overtime ?? 0),
    overtime: attendance.overtime ?? [],
    hourlyRate: Number(calculation.hourlyRate ?? 0),
    shortageValue: Number(calculation.shortageValue ?? 0),
    adjustedBase: Number(calculation.adjustedBase ?? 0),
    allowances: Number(calculation.allowances ?? 0),
    bonuses: Number(calculation.bonuses ?? 0),
    deductions: Number(calculation.deductions ?? 0),
    adjustments: Number(calculation.adjustments ?? 0),
    gross: Number(calculation.gross ?? 0),
    net: Number(calculation.net ?? 0),    deductionBreakdown: (() => {
      const vietnam = calculation.vietnam || {};
      const funds = Array.isArray(vietnam.insurance?.funds) ? vietnam.insurance.funds : [];
      const fundAmount = (code: string) => Number(funds.find((fund: any) => fund.code === code)?.employeeAmount ?? 0);
      const otherDeductions = Number(vietnam.deductions?.other ?? 0);
      const advances = Number(vietnam.deductions?.advances ?? 0);
      const socialInsurance = fundAmount("social");
      const healthInsurance = fundAmount("health");
      const unemploymentInsurance = fundAmount("unemployment");
      const personalIncomeTax = Number(vietnam.tax?.tax ?? 0);
      return { socialInsurance, healthInsurance, unemploymentInsurance, personalIncomeTax, otherDeductions, advances, total: socialInsurance + healthInsurance + unemploymentInsurance + personalIncomeTax + otherDeductions + advances };
    })(),
  };
}
