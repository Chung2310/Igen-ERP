import { describe, expect, it } from "vitest";
import { mergeSavedProject, updateProjectProgressFromTasks, shouldApplyProjectResponse } from "./kanbanProjectState";

describe("mergeSavedProject", () => {
  it("replaces the edited project immediately using the API response", () => {
    const current = [{ id: "p1", name: "Tên cũ" }, { id: "p2", name: "Khác" }] as any;
    const saved = { _id: "p1", name: "Tên mới", status: "in_progress" } as any;

    expect(mergeSavedProject(current, saved, "p1")).toEqual([
      { _id: "p1", id: "p1", name: "Tên mới", status: "in_progress" },
      { id: "p2", name: "Khác" },
    ]);
  });

  it("prepends a newly created project", () => {
    expect(mergeSavedProject([], { _id: "p1", name: "Mới" } as any, null)).toEqual([
      { _id: "p1", id: "p1", name: "Mới" },
    ]);
  });

  it("rejects an older project-list response after a mutation", () => {
    expect(shouldApplyProjectResponse(3, 4)).toBe(false);
    expect(shouldApplyProjectResponse(4, 4)).toBe(true);
  });

  it("updates affected project progress immediately from local tasks", () => {
    const projects = [{ id: "p1", progress: { completed: 0, total: 2, percent: 0 } }, { id: "p2", progress: { completed: 0, total: 1, percent: 0 } }] as any;
    const tasks = [{ projectId: "p1", status: "Done" }, { projectId: "p1", status: "In Progress" }, { projectId: "p2", status: "Archived" }] as any;
    expect(updateProjectProgressFromTasks(projects, tasks, ["p1", "p2"]).map((project) => project.progress)).toEqual([
      { completed: 1, total: 2, percent: 50 },
      { completed: 0, total: 0, percent: 0 },
    ]);
  });
});
