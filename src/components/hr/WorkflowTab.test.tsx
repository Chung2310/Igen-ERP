// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowReader } from "./WorkflowTab";

describe("WorkflowReader", () => {
  it("renders ordered steps and opens the selected step details", () => {
    render(
      <WorkflowReader
        workflow={{
          name: "Onboarding workflow",
          description: "Guide for new employees",
          steps: [
            { id: "s1", title: "Receive documents", description: "Check submitted information", note: "Keep the original files", subTasks: [{ id: "task-1", title: "Verify identity" }], attachments: [{ id: "file-1", name: "onboarding-guide.pdf", url: "/guide.pdf", type: "file" }] },
            { id: "s2", title: "Create account", description: "Grant access by role" },
          ],
        } as any}
        canEdit={false}
        onBack={vi.fn()}
        onAddStep={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Onboarding workflow")).toBeTruthy();
    expect(screen.getByText("Receive documents")).toBeTruthy();
    expect(screen.getByText("Create account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit|delete|add/i })).toBeNull();
    expect(screen.queryByText(/Dự kiến|ngày/)).toBeNull();
    expect(document.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThan(0);

    const firstStepCard = screen.getByText("Receive documents").closest("li")!;
    fireEvent.click(within(firstStepCard).getByRole("button", { name: /sửa/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Keep the original files")).toBeTruthy();
    expect(within(dialog).getByText("Verify identity")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /xem preview/i }));
    expect(screen.getByRole("dialog", { name: /preview/i })).toBeTruthy();
    expect(screen.getByText("onboarding-guide.pdf")).toBeTruthy();
  });
});
