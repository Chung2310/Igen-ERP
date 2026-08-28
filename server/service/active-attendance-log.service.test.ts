import { describe, expect, it } from "vitest";
import { isAttendanceLogActiveOnDate } from "./active-attendance-log.service";

describe("isAttendanceLogActiveOnDate", () => {
  it("keeps an unfinished log from the current work date active", () => {
    expect(isAttendanceLogActiveOnDate({ date: "2026-08-28", checkOut: null }, "2026-08-28")).toBe(true);
  });

  it("rejects an ordinary unfinished log from yesterday", () => {
    expect(isAttendanceLogActiveOnDate({
      date: "2026-08-27",
      checkOut: null,
      scheduledEndAt: new Date("2026-08-27T10:30:00.000Z"),
    }, "2026-08-28")).toBe(false);
  });

  it("keeps an unfinished overnight log whose scheduled end is today", () => {
    expect(isAttendanceLogActiveOnDate({
      date: "2026-08-27",
      checkOut: null,
      scheduledEndAt: new Date("2026-08-27T23:00:00.000Z"),
    }, "2026-08-28")).toBe(true);
  });

  it.each([
    ["legacy log", undefined],
    ["invalid end", "not-a-date"],
  ])("rejects a previous-day %s", (_label, scheduledEndAt) => {
    expect(isAttendanceLogActiveOnDate({ date: "2026-08-27", checkOut: null, scheduledEndAt }, "2026-08-28")).toBe(false);
  });

  it("rejects a completed log", () => {
    expect(isAttendanceLogActiveOnDate({
      date: "2026-08-28",
      checkOut: { time: new Date("2026-08-28T10:30:00.000Z") },
    }, "2026-08-28")).toBe(false);
  });
});
