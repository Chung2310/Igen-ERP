// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import KanbanMonthlyKpiView from "./KanbanMonthlyKpiView";

const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../../pages/Toast", () => ({ toast: toastMocks }));
vi.mock("../../services/authService", () => ({ getAccessToken: () => "token" }));

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

describe("KanbanMonthlyKpiView", () => {
  it("shows task counts, KPI percent, and employees without tasks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
      periodKey: "2026-08", periodStatus: "provisional", timezone: "Asia/Ho_Chi_Minh", closedAt: null,
      rows: [
        { employeeId: "u1", employeeName: "An", employeeAvatar: "", totalTasks: 3, completedTasks: 2, pendingTasks: 1, percent: 66.7 },
        { employeeId: "u2", employeeName: "Bình", employeeAvatar: "", totalTasks: 0, completedTasks: 0, pendingTasks: 0, percent: null },
      ],
    } }) }));
    render(<KanbanMonthlyKpiView activeBranchId="B1" initialPeriod="2026-08" />);

    expect(await screen.findByText("Tạm tính")).toBeTruthy();
    expect(screen.getByText("66,7%")).toBeTruthy();
    expect(screen.getByText("Chưa có công việc")).toBeTruthy();
    expect(screen.getByRole("row", { name: /An 2 3 1 66,7%/ })).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("period=2026-08&branchId=B1"), expect.anything());
  });

  it("reports API errors with a Vietnamese toast", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Không tải được KPI tháng." }) }));
    render(<KanbanMonthlyKpiView initialPeriod="2026-08" />);
    await vi.waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Không tải được KPI tháng."));
  });
});
