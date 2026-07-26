import { describe, expect, it } from "vitest";
import { calculatePayroll } from "./payroll-calculation.service";

describe("calculatePayroll", () => {
  it("adjusts monthly salary by shortage minutes", () => {
    const result = calculatePayroll({
      monthlySalary: 26_000_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 30,
      paidLeaveMinutesByRate: [],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    });

    expect(result.adjustedBase).toBe(25_937_500);
    expect(result.net).toBe(25_937_500);
  });

  it("adds overtime using weekday, rest-day, and holiday multipliers", () => {
    const result = calculatePayroll({
      monthlySalary: 20_800_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [],
      overtime: [
        { minutes: 60, category: "weekday" },
        { minutes: 60, category: "restDay" },
        { minutes: 60, category: "holiday" },
      ],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    });

    expect(result.overtime).toBe(650_000);
    expect(result.net).toBe(21_450_000);
  });

  it("calculates paid leave correctly without double payment", () => {
    const result = calculatePayroll({
      monthlySalary: 26_000_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [{ minutes: 480, payRate: 1 }],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    });

    // Base salary is 26,000,000. Under 100% paid leave (payRate 1), the final adjusted base should be exactly 26,000,000.
    expect(result.adjustedBase).toBe(26_000_000);
    expect(result.paidLeaveValue).toBe(1_000_000); // 8 hours of leave = 1,000,000
  });

  it("calculates 50% paid leave correctly", () => {
    const result = calculatePayroll({
      monthlySalary: 26_000_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [{ minutes: 480, payRate: 0.5 }],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    });

    // 50% paid leave should result in a deduction of 50% of 1 day's salary (500,000).
    expect(result.adjustedBase).toBe(25_500_000);
    expect(result.paidLeaveValue).toBe(500_000);
  });

  it("calculates 0% paid leave correctly", () => {
    const result = calculatePayroll({
      monthlySalary: 26_000_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [{ minutes: 480, payRate: 0 }],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    });

    // 0% paid leave should deduct a full day's salary (1,000,000).
    expect(result.adjustedBase).toBe(25_000_000);
    expect(result.paidLeaveValue).toBe(0);
  });

  it("rejects invalid monetary values and leave rates", () => {
    const base = {
      monthlySalary: 26_000_000,
      standardDays: 26,
      standardHours: 208,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [] as { minutes: number; payRate: number }[],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
    };

    expect(() => calculatePayroll({ ...base, bonuses: -1 })).toThrow("bonuses");
    expect(() => calculatePayroll({ ...base, paidLeaveMinutesByRate: [{ minutes: 60, payRate: 1.5 }] })).toThrow("payRate");
    expect(() => calculatePayroll({ ...base, adjustments: Number.NaN })).toThrow("adjustments");
  });
});
