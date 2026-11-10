import { describe, expect, it } from "vitest";
import { buildKanbanProjectListFilter, buildKanbanTaskListFilter } from "./kanban-list-filter";

describe("Kanban assistant list filters", () => {
  it("combines task search with employee visibility and requested filters", () => {
    expect(buildKanbanTaskListFilter({
      search: "bàn giao [máy]",
      status: "In Progress",
      priority: "High",
      assigneeUid: "employee-1",
      projectId: "project-1",
      dueFrom: "2026-11-05",
      dueTo: "2026-11-10",
    }, { id: "employee-1", role: "user" })).toEqual({
      status: "In Progress",
      priority: "High",
      assigneeUid: "employee-1",
      projectId: "project-1",
      dueDate: { $gte: "2026-11-05", $lte: "2026-11-10T23:59:59.999Z" },
      $and: [
        { $or: [{ assigneeUid: "employee-1" }, { creatorUid: "employee-1" }] },
        { $or: ["title", "description", "assignee", "category"].map(field => ({ [field]: { $regex: "bàn giao \\[máy\\]", $options: "i" } })) },
      ],
    });
  });

  it("filters projects by name, state, priority and date ranges", () => {
    expect(buildKanbanProjectListFilter({ search: "mở chi nhánh", status: "in_progress", priority: "urgent", startFrom: "2026-11-01", dueTo: "2026-11-30" })).toEqual({
      status: "in_progress",
      priority: "urgent",
      startAt: { $gte: new Date("2026-11-01T00:00:00.000Z") },
      dueAt: { $lt: new Date("2026-12-01T00:00:00.000Z") },
      $and: [{ name: { $regex: "mở chi nhánh", $options: "i" } }],
    });
  });

  it("ignores invalid status and date filters instead of widening to arbitrary query operators", () => {
    expect(buildKanbanProjectListFilter({ status: "$where", priority: "urgent", startFrom: "2026-02-30" })).toEqual({ priority: "urgent" });
  });
});
