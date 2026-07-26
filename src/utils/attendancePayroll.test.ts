import { describe, expect, it } from "vitest";
import { attendanceTotalsFromMinutes, calculateAttendanceWorkedMinutes } from "./attendancePayroll";

const schedule = { lunchBreakStart: "12:00", lunchBreakEnd: "13:00" };

describe("attendance history payroll calculation", () => {
  it("counts an incomplete log as zero, like payroll", () => {
    expect(calculateAttendanceWorkedMinutes("2026-07-01T01:00:00.000Z", undefined, schedule)).toBe(0);
  });

  it("subtracts only the overlapping lunch break", () => {
    expect(calculateAttendanceWorkedMinutes(
      "2026-07-01T01:00:00.000Z",
      "2026-07-01T10:00:00.000Z",
      schedule,
    )).toBe(480);
  });

  it("converts the monthly minute total to days before rounding", () => {
    expect(attendanceTotalsFromMinutes(900, 480)).toEqual({ totalHours: 15, totalDays: 1.88 });
  });
});
