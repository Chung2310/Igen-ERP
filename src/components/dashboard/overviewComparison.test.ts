import { describe, expect, it } from "vitest";
import { previousComparisonRange } from "./overviewComparison";

describe("previousComparisonRange", () => {
  it("uses the complete previous calendar period for day, week, month and year", () => {
    expect(previousComparisonRange("2026-11-06", "2026-11-06", "day")).toEqual({ from: "2026-11-05", to: "2026-11-05" });
    expect(previousComparisonRange("2026-11-02", "2026-11-06", "week")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(previousComparisonRange("2026-11-01", "2026-11-06", "month")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(previousComparisonRange("2026-01-01", "2026-11-06", "year")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("uses the immediately preceding equal-length range for a custom selection", () => {
    expect(previousComparisonRange("2026-10-24", "2026-10-30", "custom")).toEqual({ from: "2026-10-17", to: "2026-10-23" });
  });
});
