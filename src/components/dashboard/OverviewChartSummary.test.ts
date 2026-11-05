import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewChartSummary, percentChange, previousCalendarMonth, yesterday } from "./OverviewChartSummary";

describe("overview comparison", () => {
  it("uses the full previous calendar month at year boundaries", () => {
    expect(previousCalendarMonth(new Date(2026, 0, 10))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(yesterday(new Date(2026, 0, 1))).toBe("2025-12-31");
  });

  it("does not invent percentages without a baseline", () => {
    expect(percentChange(8, 4)).toBe(100);
    expect(percentChange(4, 8)).toBe(-50);
    expect(percentChange(8, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(8, null)).toBeNull();
  });

  it("marks increases, decreases and unchanged values consistently", () => {
    const markup = (value: number, previous: number) => renderToStaticMarkup(createElement(OverviewChartSummary, { value, previous, metricLabel: "Doanh thu" }));
    expect(markup(120, 100)).toContain("text-change-up");
    expect(markup(120, 100)).toContain("▲ 20%");
    expect(markup(80, 100)).toContain("text-change-down");
    expect(markup(80, 100)).toContain("▼ 20%");
    expect(markup(100, 100)).toContain("text-change-flat");
    expect(markup(100, 100)).toContain("Không thay đổi so với kỳ trước");
  });
});
