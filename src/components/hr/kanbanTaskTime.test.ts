import { describe, expect, it } from "vitest";
import { calculateEstimatedHours } from "./kanbanTaskTime";

describe("calculateEstimatedHours", () => {
  it("returns whole elapsed hours", () => {
    expect(calculateEstimatedHours("2026-08-15T08:00", "2026-08-15T17:00")).toBe(9);
  });

  it("rounds fractional elapsed hours to one decimal place", () => {
    expect(calculateEstimatedHours("2026-08-15T08:00", "2026-08-15T09:35")).toBe(1.6);
  });

  it("calculates continuously across calendar days", () => {
    expect(calculateEstimatedHours("2026-08-15T20:00", "2026-08-16T08:00")).toBe(12);
  });

  it.each([
    ["", "2026-08-15T17:00"],
    ["2026-08-15T08:00", ""],
    ["invalid", "2026-08-15T17:00"],
    ["2026-08-15T17:00", "2026-08-15T08:00"],
  ])("returns an empty value for an invalid range", (start, end) => {
    expect(calculateEstimatedHours(start, end)).toBe("");
  });
});
