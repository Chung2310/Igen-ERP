// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanProjectSummary } from "./KanbanProjectSummary";
import type { Project } from "../../types/hr";

const project: Project = { id: "1", name: "ERP", companyCode: "A", creatorUid: "u", createdAt: "2026-08-01", status: "in_progress", priority: "high", startAt: "2026-08-02", dueAt: "2026-08-30", completedAt: null, progress: { completed: 2, total: 3, percent: 67 }, attachments: [{ id: "a", name: "Brief.pdf", url: "https://example.com/a", type: "file" }] };

describe("KanbanProjectSummary", () => {
  it("shows lifecycle metadata and one progress bar in the header summary", () => {
    const { container } = render(<KanbanProjectSummary project={project} />);
    expect(screen.getByText("Đang thực hiện")).toBeTruthy();
    expect(screen.getByText("Cao")).toBeTruthy();
    expect(screen.getByText("2/3 · 67%")).toBeTruthy();
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
  });

  it("shows only extra details when expanded without repeating progress", () => {
    const { container } = render(<KanbanProjectSummary project={project} expanded />);
    const view = within(container);
    expect(view.getByText("Brief.pdf")).toBeTruthy();
    expect(view.getByText(/Chưa thiết lập/)).toBeTruthy();
    expect(view.queryByText("2/3 · 67%")).toBeNull();
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  });
});
