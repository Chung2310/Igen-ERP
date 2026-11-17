import { describe, expect, it } from "vitest";
import { buildMonthlyAttendanceReport } from "./monthly-attendance-report";

describe("buildMonthlyAttendanceReport", () => {
  it("counts worked, half, absent, approved leave, late, and early days separately", () => {
    const rows = buildMonthlyAttendanceReport(2026, 10, [
      { id: "1", displayName: "Nguyễn An" },
      { id: "2", displayName: "Trần Bình" },
    ], [
      { uid: "1", status: "Present" },
      { uid: "1", status: "Half-Day" },
      { uid: "1", status: "Late-Left-Early" },
      { uid: "1", status: "Absent" },
      { uid: "1", status: "Approved-Leave" },
    ]);

    expect(rows).toEqual([
      { employeeName: "Nguyễn An", workedDays: 2.5, absentDays: 1, leaveDays: 1, daysOff: 2, lateDays: 1, leftEarlyDays: 1 },
      { employeeName: "Trần Bình", workedDays: 0, absentDays: 0, leaveDays: 0, daysOff: 0, lateDays: 0, leftEarlyDays: 0 },
    ]);
  });

  it("rejects invalid periods instead of silently reporting another month", () => {
    expect(() => buildMonthlyAttendanceReport(2026, 13, [], [])).toThrow("không hợp lệ");
  });
});
