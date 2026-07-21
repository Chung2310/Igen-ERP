import { describe, expect, it } from "vitest";
import {
  CalendarValidationError,
  addDaysToLocalDate,
  evaluateWorkingDate,
  listLocalDates,
  toVietnamDate,
} from "./company-work-calendar.service";

describe("company work calendar calculations", () => {
  it("uses the weekly company schedule when there is no applied exception", () => {
    expect(evaluateWorkingDate("2026-04-29", [], [1, 2, 3, 4, 5])).toBe(true);
    expect(evaluateWorkingDate("2026-05-02", [], [1, 2, 3, 4, 5])).toBe(false);
  });

  it("applies holiday state and ignores disabled holidays", () => {
    expect(evaluateWorkingDate("2026-04-30", [{ dayType: "holiday", isApplied: true }], [1, 2, 3, 4, 5])).toBe(false);
    expect(evaluateWorkingDate("2026-04-30", [{ dayType: "holiday", isApplied: false }], [1, 2, 3, 4, 5])).toBe(true);
  });

  it("gives an applied working override highest precedence", () => {
    expect(evaluateWorkingDate("2026-05-02", [
      { dayType: "holiday", isApplied: true },
      { dayType: "working_override", isApplied: true },
    ], [1, 2, 3, 4, 5])).toBe(true);
  });

  it("iterates inclusive local dates without UTC drift", () => {
    expect(listLocalDates("2026-04-29", "2026-05-02")).toEqual([
      "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-02",
    ]);
    expect(addDaysToLocalDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejects malformed, reversed, and unbounded date ranges", () => {
    expect(() => listLocalDates("30/04/2026", "2026-05-01")).toThrow(CalendarValidationError);
    expect(() => listLocalDates("2026-05-02", "2026-05-01")).toThrow(CalendarValidationError);
    expect(() => listLocalDates("2000-01-01", "2020-01-01")).toThrow(CalendarValidationError);
  });

  it("formats instants using the Vietnam calendar date", () => {
    expect(toVietnamDate(new Date("2026-04-30T17:30:00.000Z"))).toBe("2026-05-01");
  });
});
