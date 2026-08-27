import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./OrgChartTab.tsx", import.meta.url), "utf8");

describe("Org chart responsive header wiring", () => {
  it("keeps filters and actions stacked below 1200px", () => {
    expect(source).toContain('data-testid="org-chart-toolbar"');
    expect(source).toContain('data-testid="org-chart-filters"');
    expect(source).toContain('data-testid="org-chart-actions"');
    expect(source).toContain("min-[1200px]:flex-row");
    expect(source).toContain("min-[1200px]:w-auto");
  });

  it("gives compact-screen controls enough width without overflowing", () => {
    expect(source).toContain('data-testid="org-chart-department-filter"');
    expect(source).toContain('data-testid="org-chart-view-toggle"');
    expect(source).toContain('data-testid="org-chart-zoom-control"');
    expect(source).toContain('data-testid="org-chart-add-button"');
    expect(source).toContain("grid w-full grid-cols-1");
    expect(source).toContain("min-[420px]:grid-cols-2");
  });
});
