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
});
