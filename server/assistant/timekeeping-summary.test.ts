import { expect, it } from "vitest";
import { summarizeDailyAttendance } from "./timekeeping-summary";

it("calculates the check-in rate against the requested roster, including employees with no check-in", () => {
  expect(summarizeDailyAttendance([
    { date: "2026-11-25", checkIn: "2026-11-25T01:00:00.000Z" },
    { date: "2026-11-25", checkIn: null },
    { date: "2026-11-25", checkIn: "" },
  ])).toEqual({ date: "2026-11-25", totalEmployees: 3, checkedIn: 1, notCheckedIn: 2, checkInRatePercent: 33.33 });
});

it("does not report a misleading zero percent when the roster is empty", () => {
  expect(summarizeDailyAttendance([])).toEqual({ totalEmployees: 0, checkedIn: 0, notCheckedIn: 0, checkInRatePercent: null });
});
