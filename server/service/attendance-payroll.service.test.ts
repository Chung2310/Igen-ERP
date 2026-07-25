import { describe, expect, it } from "vitest";
import { summarizeAttendanceForPayroll } from "./attendance-payroll.service";

describe("summarizeAttendanceForPayroll", () => {
  it("converts a full day and a half day into shortage minutes", () => {
    const result = summarizeAttendanceForPayroll({
      standardDailyMinutes: 480,
      logs: [
        { date: "2026-07-01", checkIn: "08:00", checkOut: "17:00", status: "Present" },
        { date: "2026-07-02", checkIn: "08:00", checkOut: "12:00", status: "Half-Day" },
      ],
      paidLeaves: [],
      overtime: [],
    });

    expect(result.workedMinutes).toBe(720);
    expect(result.shortageMinutes).toBe(240);
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
  });
});
