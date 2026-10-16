// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkflowTab, { WorkflowReader } from "./WorkflowTab";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    expect(screen.queryByText("1.1 Verify identity")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết giai đoạn con" }));
    expect(screen.getByText("1.1 Verify identity")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn chi tiết giai đoạn con" }));
    expect(screen.queryByText("1.1 Verify identity")).toBeNull();

    const firstStepCard = screen.getByText("Receive documents").closest("li")!;
    fireEvent.click(firstStepCard);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Keep the original files")).toBeTruthy();
    expect(within(dialog).getByText("Verify identity")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /xem preview/i }));
    expect(screen.getByRole("dialog", { name: /preview/i })).toBeTruthy();
    expect(screen.getByText("onboarding-guide.pdf")).toBeTruthy();
  });
});

describe("WorkflowTab delete", () => {
  it("opens confirmation from the detail view and deletes the selected workflow", async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === "DELETE") {
        deleted = true;
        return { ok: true, json: async () => ({ status: "success" }) };
      }
      return { ok: true, json: async () => ({ data: deleted ? [] : [{ _id: "507f1f77bcf86cd799439011", name: "Quy trình thử", category: "", description: "", steps: [] }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<WorkflowTab userProfile={{ uid: "admin", role: "admin" } as any} selectedCompanyCode="MAIN" isManager />);
    await screen.findByText("Quy trình thử");
    fireEvent.click(screen.getByTitle("Xem chi tiết quy trình"));
    fireEvent.click(screen.getByTitle("Xóa quy trình"));

    const dialog = screen.getByRole("dialog", { name: "Xóa quy trình?" });
    expect(within(dialog).getAllByRole("button")).toHaveLength(2); // X đóng và nút xác nhận
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa quy trình" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/crud/workflows/507f1f77bcf86cd799439011",
      expect.objectContaining({ method: "DELETE" }),
    ));
    await screen.findByText("Chưa có quy trình nào");
  });
});
