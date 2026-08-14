import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./KanbanTab.tsx", import.meta.url), "utf8");

describe("Kanban project progress wiring", () => {
  it("refreshes projects after all five task mutation paths", () => {
    expect(source.match(/applyTaskMutation\(/g)).toHaveLength(5);
  });
});
