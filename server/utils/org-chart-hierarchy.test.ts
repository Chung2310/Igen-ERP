import { describe, expect, it } from "vitest";
import { assertValidOrgChartParent, calculateOrgChartDescendantLevels } from "./org-chart-hierarchy";

describe("org chart parent changes", () => {
  it("rejects assigning an employee beneath themselves or one of their descendants", () => {
    const parents = new Map([["employee", "manager"], ["manager", "director"], ["director", undefined], ["child", "employee"]]);
    expect(() => assertValidOrgChartParent("employee", "employee", parents)).toThrow("chính mình");
    expect(() => assertValidOrgChartParent("employee", "child", parents)).toThrow("cấp dưới");
    expect(() => assertValidOrgChartParent("employee", "director", parents)).not.toThrow();
  });

  it("recalculates descendant levels after moving a manager", () => {
    const levels = calculateOrgChartDescendantLevels("manager", 4, [
      { id: "manager" },
      { id: "employee", parentId: "manager" },
      { id: "intern", parentId: "employee" },
      { id: "peer", parentId: "elsewhere" },
    ]);
    expect([...levels]).toEqual([["employee", 5], ["intern", 6]]);
  });
});
