import { describe, expect, it } from "vitest";
import { aggregateMonthlyKpiRows, currentPeriodKey, periodBounds } from "./kanban-monthly-kpi.service";

const employees = [
  { employeeId: "u1", employeeName: "An", employeeAvatar: "a.png" },
  { employeeId: "u2", employeeName: "Bình", employeeAvatar: "" },
];

describe("kanban monthly KPI rules", () => {
  it("builds Vietnam month boundaries and current period", () => {
    expect(periodBounds("2026-08")).toEqual({
      start: new Date("2026-07-31T17:00:00.000Z"),
      end: new Date("2026-08-31T17:00:00.000Z"),
    });
    expect(currentPeriodKey(new Date("2026-08-31T18:00:00.000Z"))).toBe("2026-09");
    expect(() => periodBounds("2026-13")).toThrow("Kỳ KPI không hợp lệ");
  });

  it("counts Done and legacy done, excludes Archived, and rounds percent", () => {
    const rows = aggregateMonthlyKpiRows(employees, [
      { assigneeUid: "u1", dueDate: "2026-08-01T08:00", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-08-15T08:00:00+07:00", status: "done" },
      { assigneeUid: "u1", dueDate: "2026-08-20T08:00", status: "In Progress" },
      { assigneeUid: "u1", dueDate: "2026-08-21T08:00", status: "Archived" },
      { assigneeUid: "u1", dueDate: "invalid", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-09-01T00:00", status: "Done" },
    ], "2026-08");

    expect(rows[0]).toMatchObject({ totalTasks: 3, completedTasks: 2, pendingTasks: 1, percent: 66.7 });
    expect(rows[1]).toMatchObject({ totalTasks: 0, completedTasks: 0, pendingTasks: 0, percent: null });
  });

  it("includes both edges correctly for local datetime values", () => {
    const rows = aggregateMonthlyKpiRows(employees.slice(0, 1), [
      { assigneeUid: "u1", dueDate: "2026-08-01T00:00", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-08-31T23:59:59", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-07-31T23:59:59", status: "Done" },
    ], "2026-08");
    expect(rows[0].totalTasks).toBe(2);
  });
});
