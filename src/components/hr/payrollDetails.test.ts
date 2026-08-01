import { describe, expect, it } from "vitest";
import { buildPayrollDetails } from "./payrollDetails";

describe("buildPayrollDetails", () => {
  it("exposes the Vietnam deduction breakdown", () => {
    const vietnamData = { insurance: { funds: [{ code: "social", employeeAmount: 800000 }, { code: "health", employeeAmount: 150000 }, { code: "unemployment", employeeAmount: 100000 }] }, tax: { tax: 350000, deductions: { personal: 11000000, dependents: 4400000, insurance: 1050000, total: 16450000 } }, deductions: { other: 200000, advances: 500000, total: 2100000 } };
    const details = buildPayrollDetails({}, { net: 10000000 }, vietnamData);
    expect(details.vietnam).toEqual(vietnamData);
    expect(details.deductionBreakdown).toEqual(expect.objectContaining({ socialInsurance: 800000, healthInsurance: 150000, unemploymentInsurance: 100000, personalIncomeTax: 350000, otherDeductions: 200000, advances: 500000, total: 2100000 }));
  });
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
