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

  it("counts only on-time Done tasks, excludes late and Archived tasks, and rounds percent", () => {
    const rows = aggregateMonthlyKpiRows(employees, [
      { assigneeUid: "u1", dueDate: "2026-08-01T08:00", completedAt: "2026-08-01T07:59", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-08-15T08:00:00+07:00", completedAt: "2026-08-15T08:01:00+07:00", status: "done" },
      { assigneeUid: "u1", dueDate: "2026-08-20T08:00", status: "In Progress" },
      { assigneeUid: "u1", dueDate: "2026-08-21T08:00", completedAt: "2026-08-21T07:00", status: "Archived" },
      { assigneeUid: "u1", dueDate: "invalid", completedAt: "2026-08-01T07:00", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-09-01T00:00", completedAt: "2026-08-31T23:00", status: "Done" },
    ], "2026-08");

    expect(rows[0]).toMatchObject({ totalTasks: 3, completedTasks: 1, pendingTasks: 2, percent: 33.3 });
    expect(rows[1]).toMatchObject({ totalTasks: 0, completedTasks: 0, pendingTasks: 0, percent: null });
  });

  it("includes both edges correctly for local datetime values", () => {
    const rows = aggregateMonthlyKpiRows(employees.slice(0, 1), [
      { assigneeUid: "u1", dueDate: "2026-08-01T00:00", completedAt: "2026-08-01T00:00", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-08-31T23:59:59", completedAt: "2026-08-31T23:59:59", status: "Done" },
      { assigneeUid: "u1", dueDate: "2026-07-31T23:59:59", completedAt: "2026-07-31T23:59:59", status: "Done" },
    ], "2026-08");
    expect(rows[0].totalTasks).toBe(2);
  });

  it("does not award KPI when a Done task has no completion timestamp", () => {
    const rows = aggregateMonthlyKpiRows(employees.slice(0, 1), [
      { assigneeUid: "u1", dueDate: "2026-08-10T08:00", status: "Done" },
    ], "2026-08");

    expect(rows[0]).toMatchObject({ totalTasks: 1, completedTasks: 0, pendingTasks: 1, percent: 0 });
  });
});
