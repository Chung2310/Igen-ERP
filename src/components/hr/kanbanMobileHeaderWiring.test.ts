import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./KanbanTab.tsx", import.meta.url), "utf8");

describe("Kanban mobile header wiring", () => {
  it("orders title, full-width tabs, and controls for small screens", () => {
    const title = source.indexOf('data-testid="kanban-header-title"');
    const tabs = source.indexOf('data-testid="kanban-view-tabs"');
    const controls = source.indexOf('data-testid="kanban-header-controls"');
    expect(title).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(title);
    expect(controls).toBeGreaterThan(tabs);
    expect(source).toContain('data-testid="kanban-view-tabs"\n                  className="flex w-full min-w-0');
    expect(source).toContain("overflow-x-auto");
    expect(source).not.toContain('aria-label="Cuộn tab sang trái"');
    expect(source).not.toContain('aria-label="Cuộn tab sang phải"');
  });

  it("keeps the stacked responsive layout below 1200px", () => {
    expect(source).toContain('data-testid="kanban-header-controls"');
    expect(source).toContain("w-full flex-col");
    expect(source).toContain('data-testid="kanban-person-filter"');
    expect(source).toContain('data-testid="kanban-person-filter" className="flex w-full items-center gap-1.5 min-[1200px]:w-auto"');
    expect(source).toContain('data-testid="kanban-manager-actions"');
    expect(source).toContain("grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 min-[1200px]:flex min-[1200px]:w-auto");
    expect(source).toContain("min-[1200px]:flex-row");
    expect(source).toContain("min-[1200px]:w-auto");
  });

  it("keeps the selected tab visible in the mobile scroller", () => {
    expect(source).toContain("tabRefs");
    expect(source).toContain("selectKanbanViewTab");
    expect(source).toContain('scrollIntoView({');
    expect(source).toContain('behavior: "smooth"');
    expect(source).toContain('block: "nearest"');
    expect(source).toContain('inline: "nearest"');
    expect(source).toContain("tabRefs.current[vt] = element");
    expect(source).toContain("onClick={() => selectKanbanViewTab(vt)}");
  });
});
