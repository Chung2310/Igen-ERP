import { describe, expect, it } from "vitest";
import { summarizeAttendanceForPayroll } from "./attendance-payroll.service";

describe("summarizeAttendanceForPayroll", () => {
  it("converts a full day and a half day into shortage minutes", () => {
    const result = summarizeAttendanceForPayroll({
      standardDailyMinutes: 480,
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      logs: [
        { date: "2026-07-01", checkIn: "08:00", checkOut: "17:00", status: "Present" },
        { date: "2026-07-02", checkIn: "08:00", checkOut: "12:00", status: "Half-Day" },
      ],
      paidLeaves: [],
      overtime: [],
    });

    expect(result.workedMinutes).toBe(720);
    expect(result.shortageMinutes).toBe(240);
    expect(result.workedDays).toBe(1.5);
    expect(result.shortageDays).toBe(0.5);
  });

  it("subtracts the configured break overlap instead of a fixed 60 minutes", () => {
    const result = summarizeAttendanceForPayroll({
      standardDailyMinutes: 450,
      lunchBreakStart: "12:00",
      lunchBreakEnd: "12:30",
      logs: [{ date: "2026-07-04", checkIn: "08:00", checkOut: "16:00", status: "Present" }],
      paidLeaves: [],
      overtime: [],
    });

    expect(result.workedMinutes).toBe(450);
    expect(result.shortageMinutes).toBe(0);
  });

  it("supports shifts crossing midnight", () => {
    const result = summarizeAttendanceForPayroll({
      standardDailyMinutes: 480,
      logs: [{ date: "2026-07-04", checkIn: "22:00", checkOut: "06:00", status: "Present" }],
      paidLeaves: [],
      overtime: [],
    });

    expect(result.workedMinutes).toBe(480);
  });

  it("keeps approved paid leave out of shortage", () => {
    const result = summarizeAttendanceForPayroll({
      standardDailyMinutes: 480,
      logs: [{ date: "2026-07-03", status: "Approved-Leave" }],
      paidLeaves: [{ date: "2026-07-03", payRate: 1 }],
      overtime: [],
    });

    expect(result.shortageMinutes).toBe(0);
    expect(result.paidLeaveMinutesByRate).toEqual([{ minutes: 480, payRate: 1 }]);
    expect(result.workedDays).toBe(0);
  });
});
