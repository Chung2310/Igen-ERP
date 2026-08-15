import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Kanban task estimated-time wiring", () => {
  it("recalculates estimated hours when either datetime changes", () => {
    const source = readFileSync(new URL("./KanbanTab.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { calculateEstimatedHours } from "./kanbanTaskTime";');
    expect(source).toMatch(/setEditEstTime\(calculateEstimatedHours\(editStartTime, editDueDate\)\)/);
    expect(source).toMatch(/\[editStartTime, editDueDate\]/);
  });
});
