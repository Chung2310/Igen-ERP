import { describe, expect, it } from "vitest";
import { attendanceDisplayStatus, attendanceTotalsFromMinutes, calculateAttendanceWorkedMinutes, hasApprovedPayrollLeave } from "./attendancePayroll";

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

  it("counts only approved leave applications belonging to the employee", () => {
    const applications = [{
      employeeId: "employee-1",
      status: "approved",
      startDate: "2026-07-02T01:00:00.000Z",
      endDate: "2026-07-02T10:00:00.000Z",
    }];

    expect(hasApprovedPayrollLeave(applications, "employee-1", "2026-07-02")).toBe(true);
    expect(hasApprovedPayrollLeave(applications, "employee-2", "2026-07-02")).toBe(false);
  });

  it("does not label incomplete or short attendance as on time", () => {
    expect(attendanceDisplayStatus("Present", true, false, 0, 480)).toBe("Incomplete");
    expect(attendanceDisplayStatus("Present", true, true, 240, 480)).toBe("Partial");
    expect(attendanceDisplayStatus("Present", true, true, 480, 480)).toBe("Present");
  });
});
