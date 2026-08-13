import { describe, expect, it } from "vitest";
import { mergeSavedProject, shouldApplyProjectResponse } from "./kanbanProjectState";

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
});
