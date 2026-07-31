import { describe, expect, it } from "vitest";
import { buildPayrollDetails } from "./payrollDetails";

describe("buildPayrollDetails", () => {
  it("combines calculation and attendance data for the payroll detail modal", () => {
    expect(buildPayrollDetails({
      monthlySalary: 26000000,
      standardHours: 208,
      standardDays: 26,
      workedMinutes: 9600,
      workedDays: 20,
      shortageMinutes: 2880,
      paidLeaveMinutesByRate: [{ minutes: 480, payRate: 1 }],
      overtime: [{ minutes: 120, category: "weekday" }],
    }, {
      monthlySalary: 26000000,
      hourlyRate: 125000,
      adjustedBase: 25000000,
      shortageValue: 1000000,
      paidLeaveValue: 1000000,
      overtime: 375000,
      allowances: 500000,
      bonuses: 1000000,
      deductions: 200000,
      adjustments: -100000,
      gross: 26875000,
      net: 26675000,
    })).toEqual(expect.objectContaining({
      monthlySalary: 26000000,
      workedDays: 20,
      shortageDays: 0.23076923076923078,
      paidLeaveValue: 1000000,
      overtimeValue: 375000,
      allowances: 500000,
      bonuses: 1000000,
      deductions: 200000,
      adjustments: -100000,
      gross: 26875000,
      net: 26675000,
    }));
  });
});
