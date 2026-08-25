import { describe, expect, it } from "vitest";
import { visibleMonthlyKpiRows } from "./kanban.router";

const rows = [{ employeeId: "u1" }, { employeeId: "u2" }] as any[];

describe("kanban KPI access", () => {
  it("shows every row to managers and only the own row to employees", () => {
    expect(visibleMonthlyKpiRows(rows, { id: "u1", role: "manager" })).toHaveLength(2);
    expect(visibleMonthlyKpiRows(rows, { id: "u1", role: "branch_owner" })).toHaveLength(2);
    expect(visibleMonthlyKpiRows(rows, { id: "u1", role: "user" })).toEqual([{ employeeId: "u1" }]);
  });
});
