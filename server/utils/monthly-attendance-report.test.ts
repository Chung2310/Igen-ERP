import { describe, expect, it } from "vitest";
import { buildApprovedLeaveAttendanceLogs, buildMonthlyAttendanceReport } from "./monthly-attendance-report";

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
      { employeeName: "Nguyễn An", workedDays: 2.5, absentDays: 1, leaveDays: 1, daysOff: 2, lateDays: 1, leftEarlyDays: 1, unrecordedDays: 0 },
      { employeeName: "Trần Bình", workedDays: 0, absentDays: 0, leaveDays: 0, daysOff: 0, lateDays: 0, leftEarlyDays: 0, unrecordedDays: 0 },
    ]);
  });

  it("counts missing logs only on scheduled working dates during employment", () => {
    const rows = buildMonthlyAttendanceReport(2026, 10, [
      { id: "1", displayName: "Nguyễn An", createdAt: "2026-10-05" },
      { id: "2", displayName: "Trần Bình", createdAt: "2026-10-06" },
    ], [
      { uid: "1", date: "2026-10-01", status: "Present" },
      { uid: "1", date: "2026-10-05", status: "Present" },
      { uid: "2", date: "2026-10-07", status: "Present" },
    ], ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"]);

    expect(rows.map(row => [row.employeeName, row.unrecordedDays])).toEqual([["Nguyễn An", 2], ["Trần Bình", 1]]);
  });

  it("rejects invalid periods instead of silently reporting another month", () => {
    expect(() => buildMonthlyAttendanceReport(2026, 13, [], [])).toThrow("không hợp lệ");
  });
});

describe("buildApprovedLeaveAttendanceLogs", () => {
  it("uses approved leave snapshots, falls back to working dates, and avoids overwriting attendance", () => {
    const leaveLogs = buildApprovedLeaveAttendanceLogs(2026, 10, [
      { id: "1", displayName: "Nguyễn An" },
      { id: "2", displayName: "Trần Bình" },
    ], [
      { uid: "1", date: "2026-10-06", status: "Present" },
    ], [
      { employeeId: "1", requestKind: "leave", chargeableDates: ["2026-10-05", "2026-10-06", "2026-11-02"] },
      { employeeId: "2", startDate: "2026-10-30T00:00:00.000Z", endDate: "2026-11-02T00:00:00.000Z" },
      { employeeId: "1", requestKind: "event", chargeableDates: ["2026-10-07"] },
    ], ["2026-10-30", "2026-10-31", "2026-11-02"]);

    expect(leaveLogs).toEqual([
      { uid: "1", date: "2026-10-05", status: "Approved-Leave" },
      { uid: "2", date: "2026-10-30", status: "Approved-Leave" },
      { uid: "2", date: "2026-10-31", status: "Approved-Leave" },
    ]);
  });
});
