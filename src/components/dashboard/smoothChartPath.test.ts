import { describe, expect, it } from "vitest";
import { smoothChartPath } from "./smoothChartPath";

describe("smoothChartPath", () => {
  it("draws a smooth path through three or more ordered observations", () => {
    const path = smoothChartPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
    expect(path).toMatch(/^M 0 10 C /);
    expect(path).toContain(" 10 0 C ");
    expect(path).toMatch(/ 20 10$/);
  });

  it("does not interpolate across missing observations", () => {
    const path = smoothChartPath([{ x: 0, y: 10 }, { x: 10, y: 0 }, null, { x: 30, y: 5 }]);
    expect(path).toBe("M 0 10 L 10 0 M 30 5");
  });

  it("keeps two observations as a straight segment", () => {
    expect(smoothChartPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe("M 0 0 L 10 10");
  });
});
