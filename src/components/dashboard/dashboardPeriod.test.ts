import { describe, expect, it } from "vitest";
import { countCreatedInRange, getDashboardRange, localDateKey } from "./dashboardPeriod";

describe("enterprise dashboard period", () => {
  it("counts records on both dates of a custom range", () => {
    const range = getDashboardRange("custom", "2026-10-01", "2026-10-17");
    expect(range.valid).toBe(true);
    expect(countCreatedInRange([
      { createdAt: "2026-10-01T00:00:00+07:00" },
      { createdAt: "2026-10-17T23:59:59+07:00" },
      { createdAt: "2026-10-18T00:00:00+07:00" },
    ], range.start, range.end)).toBe(2);
  });

  it("uses calendar weeks and rejects an inverted range", () => {
    const now = new Date(2026, 9, 17, 10);
    expect(localDateKey(getDashboardRange("week", "", "", now).start)).toBe("2026-10-12");
    expect(getDashboardRange("custom", "2026-10-18", "2026-10-17").valid).toBe(false);
  });
});
