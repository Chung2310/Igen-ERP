import { describe, expect, it } from "vitest";
import { buildAttendanceDailyOverview } from "./attendanceDailyOverview";

const employees = [
  { uid: "on-time", displayName: "Đúng giờ", email: "ontime@igen.vn" },
  { uid: "late", displayName: "Đi muộn", email: "late@igen.vn" },
  { uid: "early", displayName: "Về sớm", email: "early@igen.vn" },
  { uid: "both", displayName: "Muộn sớm", email: "both@igen.vn" },
  { uid: "missing", displayName: "Thiếu công", email: "missing@igen.vn" },
  { uid: "leave", displayName: "Nghỉ phép", email: "leave@igen.vn" },
  { uid: "wfh", displayName: "Làm tại nhà", email: "wfh@igen.vn" },
  { uid: "absent", displayName: "Vắng", email: "absent@igen.vn" },
];

const log = (uid: string, status: string) => ({
  uid,
  date: "2026-08-13",
  status,
  checkIn: { time: "2026-08-13T01:00:00.000Z" },
  checkOut: { time: "2026-08-13T10:00:00.000Z" },
});

describe("buildAttendanceDailyOverview", () => {
  it("classifies each employee into one daily attendance category", () => {
    const result = buildAttendanceDailyOverview({
      date: "2026-08-13",
      today: "2026-08-13",
      employees,
      logs: [
        log("on-time", "Present"),
        log("late", "Late"),
        log("early", "Left-Early"),
        log("both", "Late-Left-Early"),
        { ...log("missing", "Present"), checkOut: null },
        log("leave", "Approved-Leave"),
        log("wfh", "Approved-WFH"),
      ],
      isWorkingDay: () => true,
      isHoliday: () => false,
    });

    expect(result.counts).toMatchObject({
      all: 8,
      on_time: 1,
      late: 1,
      early: 1,
      late_early: 1,
      incomplete: 1,
      leave: 1,
      wfh: 1,
      absent: 1,
    });
    expect(Object.values(result.groups).flat()).toHaveLength(8);
    expect(result.groups.late[0]).toMatchObject({ uid: "late", checkIn: "08:00", checkOut: "17:00" });
  });

  it("keeps an explicit absent log in unauthorized absence", () => {
    const result = buildAttendanceDailyOverview({
      date: "2026-08-13", today: "2026-08-13", employees: employees.slice(-1),
      logs: [log("absent", "Absent")], isWorkingDay: () => true, isHoliday: () => false,
    });
    expect(result.counts.absent).toBe(1);
  });

  it("uses approved applications before inferring an absence", () => {
    const result = buildAttendanceDailyOverview({
      date: "2026-08-13",
      today: "2026-08-13",
      employees: employees.slice(-1),
      logs: [],
      applications: [{ employeeId: "absent", status: "approved", type: "leave", startDate: "2026-08-13", endDate: "2026-08-13" }],
      isWorkingDay: () => true,
      isHoliday: () => false,
    });

    expect(result.counts.leave).toBe(1);
    expect(result.counts.absent).toBe(0);
  });

  it.each([
    ["a future date", "2026-08-14", true, false],
    ["a non-working date", "2026-08-13", false, false],
    ["a holiday", "2026-08-13", true, true],
  ])("does not infer absence on %s", (_label, date, working, holiday) => {
    const result = buildAttendanceDailyOverview({
      date,
      today: "2026-08-13",
      employees: employees.slice(-1),
      logs: [],
      isWorkingDay: () => working,
      isHoliday: () => holiday,
    });

    expect(result.counts.absent).toBe(0);
    expect(result.all[0].category).toBe("not_scheduled");
  });
});
