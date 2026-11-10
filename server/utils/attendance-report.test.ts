import { describe, expect, it } from "vitest";
import { buildAttendanceReportRows } from "./attendance-report";

describe("daily employee attendance report", () => {
  it("joins by employee internally and returns a concise, ID-free report for everyone", () => {
    const rows = buildAttendanceReportRows("2026-11-02", [
      { _id: "private-employee-1", displayName: "Đỗ Đức Chung", monthlySalary: 25000000 } as any,
      { _id: "private-employee-2", displayName: "Nguyễn An" },
    ], [
      { uid: "private-employee-1", status: "Late", checkIn: { time: "2026-11-02T01:10:00.000Z", latitude: 21, longitude: 105 } as any },
    ]);

    expect(rows).toEqual([
      { date: "2026-11-02", employeeName: "Đỗ Đức Chung", attendanceStatus: "Đã vào ca, đi muộn", checkIn: "2026-11-02T01:10:00.000Z", checkOut: null },
      { date: "2026-11-02", employeeName: "Nguyễn An", attendanceStatus: "Chưa ghi nhận", checkIn: null, checkOut: null },
    ]);
    expect(JSON.stringify(rows)).not.toContain("private-employee");
    expect(JSON.stringify(rows)).not.toContain("monthlySalary");
    expect(JSON.stringify(rows)).not.toContain("latitude");
  });

  it("labels approved leave and completed attendance in Vietnamese", () => {
    expect(buildAttendanceReportRows("2026-11-02", [
      { uid: "employee-1", displayName: "Trần Bình" },
      { uid: "employee-2", displayName: "Lê Mai" },
    ], [
      { uid: "employee-1", status: "Approved-Leave" },
      { uid: "employee-2", status: "Present", checkIn: { time: "08:00" }, checkOut: { time: "17:00" } },
    ])).toMatchObject([
      { employeeName: "Trần Bình", attendanceStatus: "Nghỉ phép" },
      { employeeName: "Lê Mai", attendanceStatus: "Đã vào và ra ca" },
    ]);
  });
});
