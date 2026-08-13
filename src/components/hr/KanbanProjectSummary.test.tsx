// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KanbanProjectSummary } from "./KanbanProjectSummary";

describe("KanbanProjectSummary", () => {
  it("shows lifecycle metadata, calculated fraction, dates, and documents", () => {
    render(<KanbanProjectSummary project={{ id: "1", name: "ERP", companyCode: "A", creatorUid: "u", createdAt: "2026-08-01", status: "in_progress", priority: "high", startAt: "2026-08-02", dueAt: "2026-08-30", completedAt: null, progress: { completed: 2, total: 3, percent: 67 }, attachments: [{ id: "a", name: "Brief.pdf", url: "https://example.com/a", type: "file" }] }} expanded />);
    expect(screen.getByText("Đang thực hiện")).toBeTruthy();
    expect(screen.getByText("Cao")).toBeTruthy();
    expect(screen.getByText("2/3 · 67%")).toBeTruthy();
    expect(screen.getByText("Brief.pdf")).toBeTruthy();
    expect(screen.getByText(/Chưa thiết lập/)).toBeTruthy();
  });
});
