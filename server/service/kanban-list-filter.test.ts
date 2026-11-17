import { afterEach, describe, expect, it, vi } from "vitest";
import { buildKanbanTaskListFilter } from "./kanban-list-filter";

afterEach(() => vi.useRealTimers());

describe("buildKanbanTaskListFilter", () => {
  it("selects overdue tasks without completed or archived tasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T04:00:00.000Z"));
    expect(buildKanbanTaskListFilter({ overdue: true }, { role: "admin" })).toMatchObject({
      dueDate: { $lt: "2026-11-17T00:00:00.000Z" },
      $and: [{ status: { $nin: ["Done", "Archived"] } }],
    });
  });

  it("combines overdue filtering with a requested status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T04:00:00.000Z"));
    expect(buildKanbanTaskListFilter({ overdue: "true", status: "In Progress" }, { role: "admin" })).toMatchObject({
      status: "In Progress",
      dueDate: { $lt: "2026-11-17T00:00:00.000Z" },
      $and: [{ status: { $nin: ["Done", "Archived"] } }],
    });
  });
});
