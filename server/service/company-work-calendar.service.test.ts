import { describe, expect, it } from "vitest";
import { buildCalendarDayFilter } from "./company-work-calendar.service";

describe("buildCalendarDayFilter", () => {
  it("preserves the year-wide query when no month filter is supplied", () => {
    expect(buildCalendarDayFilter("ACME", 2026, { appliedOnly: true })).toEqual({ companyCode: "ACME", sourceYear: 2026, isApplied: true });
  });

  it("limits a holiday report to applied holidays in the requested month", () => {
    expect(buildCalendarDayFilter("ACME", 2026, { month: 2, appliedOnly: true, holidaysOnly: true })).toEqual({
      companyCode: "ACME",
      sourceYear: 2026,
      isApplied: true,
      dayType: { $in: ["holiday", "substitute_holiday"] },
      date: { $gte: "2026-02-01", $lte: "2026-02-28" },
    });
  });

  it("rejects an invalid month", () => {
    expect(() => buildCalendarDayFilter("ACME", 2026, { month: 13 })).toThrow("Tháng không hợp lệ");
  });
});
