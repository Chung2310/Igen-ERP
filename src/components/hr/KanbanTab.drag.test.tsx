// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KanbanTab from "./KanbanTab";

vi.mock("../../services/authService", () => ({ getAccessToken: () => "token" }));
vi.mock("../../services/socketService", () => ({ socketService: { on: () => () => undefined } }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Kanban work board", () => {
  it("moves a dragged task into another status column using the existing update request", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/v1/kanban/tasks") && init?.method === "PATCH") {
        return { ok: true, json: async () => ({ data: {} }) };
      }
      if (url.includes("/api/v1/kanban/tasks")) {
        return { ok: true, json: async () => ({ data: [{
          _id: "task-1", title: "JOB1", description: "Mô tả", status: "Not Started",
          priority: "Medium", assignee: "An", assigneeUid: "u1", creatorUid: "admin",
          companyCode: "MAIN", createdAt: "2026-10-16T00:00:00.000Z", dueDate: "2026-10-20T00:00:00.000Z",
        }] }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<KanbanTab userProfile={{ uid: "admin" }} selectedCompanyCode="MAIN" employees={[]} isManager usersList={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Bảng công việc" }));
    const card = (await screen.findByText("JOB1")).closest<HTMLElement>('[draggable="true"]');
    const columns = document.querySelectorAll<HTMLElement>("#kanban_board_columns > div");
    expect(card).not.toBeNull();
    expect(columns).toHaveLength(4);

    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      dropEffect: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) || "",
    };
    fireEvent.dragStart(card!, { dataTransfer });
    fireEvent.dragOver(columns[1], { dataTransfer });
    fireEvent.drop(columns[1], { dataTransfer });

    await vi.waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([url, options]) => String(url).endsWith("/tasks/task-1") && options?.method === "PATCH");
      expect(patchCall).toBeTruthy();
      expect(JSON.parse(String(patchCall?.[1]?.body)).status).toBe("In Progress");
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa công việc JOB1" }));
    expect(screen.getByRole("dialog", { name: "Xóa công việc" })).toBeTruthy();
  });
});
