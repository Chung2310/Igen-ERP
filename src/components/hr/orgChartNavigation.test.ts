import { describe, expect, it } from "vitest";
import {
  calculateOrgChartZoom,
  canScrollOrgChart,
  classifyOrgChartWheel,
  normalizeWheelDelta,
} from "./orgChartNavigation";

describe("classifyOrgChartWheel", () => {
  it("treats ctrl-wheel as pinch zoom", () => {
    expect(classifyOrgChartWheel({ deltaX: 0, deltaY: -2, deltaMode: 0, ctrlKey: true })).toBe("zoom");
  });

  it("treats high-resolution vertical deltas as touchpad pan", () => {
    expect(classifyOrgChartWheel({ deltaX: 0, deltaY: 7.5, deltaMode: 0, ctrlKey: false })).toBe("pan");
  });

  it("treats horizontal movement as touchpad pan", () => {
    expect(classifyOrgChartWheel({ deltaX: 18, deltaY: 2, deltaMode: 0, ctrlKey: false })).toBe("pan");
  });

  it("treats line-based vertical wheel ticks as mouse zoom", () => {
    expect(classifyOrgChartWheel({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false })).toBe("zoom");
  });

  it("treats large pixel-based vertical wheel ticks as mouse zoom", () => {
    expect(classifyOrgChartWheel({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false })).toBe("zoom");
  });
});

describe("normalizeWheelDelta", () => {
  it("normalizes pixel, line, and page delta modes", () => {
    expect(normalizeWheelDelta(5, 0)).toBe(5);
    expect(normalizeWheelDelta(2, 1)).toBe(32);
    expect(normalizeWheelDelta(1, 2, 600)).toBe(600);
  });
});

describe("calculateOrgChartZoom", () => {
  it("zooms proportionally and clamps the supported range", () => {
    expect(calculateOrgChartZoom(1, -20)).toBeGreaterThan(1);
    expect(calculateOrgChartZoom(1, -80)).toBeGreaterThan(calculateOrgChartZoom(1, -20));
    expect(calculateOrgChartZoom(1.49, -1000)).toBe(1.5);
    expect(calculateOrgChartZoom(0.51, 1000)).toBe(0.5);
    expect(calculateOrgChartZoom(1, 0)).toBe(1);
  });
});

describe("canScrollOrgChart", () => {
  const middle = {
    scrollLeft: 50,
    scrollTop: 50,
    scrollWidth: 300,
    scrollHeight: 300,
    clientWidth: 100,
    clientHeight: 100,
  };

  it("allows chart panning while content remains in the gesture direction", () => {
    expect(canScrollOrgChart(middle, 0, 10)).toBe(true);
    expect(canScrollOrgChart(middle, -10, 0)).toBe(true);
  });

  it("releases scrolling to the parent at the matching boundary", () => {
    expect(canScrollOrgChart({ ...middle, scrollTop: 0 }, 0, -10)).toBe(false);
    expect(canScrollOrgChart({ ...middle, scrollTop: 200 }, 0, 10)).toBe(false);
  });
});
