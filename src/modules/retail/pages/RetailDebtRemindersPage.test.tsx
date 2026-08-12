// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailDebtRemindersApi } from "../api/retailDebtReminders.api";
import RetailDebtRemindersPage from "./RetailDebtRemindersPage";

vi.mock("../../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "B1" }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../api/retailDebtReminders.api", () => ({ retailDebtRemindersApi: { listRuns: vi.fn(), getRun: vi.fn(), runNow: vi.fn(), retry: vi.fn() } }));
const run = { _id: "r1", businessDate: "2026-08-12", status: "completed", overdueOrders: 2, sent: 3, failed: 1, queued: 0, duplicates: 1, startedAt: "2026-08-12T00:00:00Z" };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(retailDebtRemindersApi.listRuns).mockResolvedValue({ items: [run], total: 1 }); vi.mocked(retailDebtRemindersApi.getRun).mockResolvedValue({ run, deliveries: [{ _id: "d1", channel: "email", status: "failed", failureType: "temporary", attempt: 1, maxAttempts: 3, payload: { to: "a@example.com" } }] }); vi.mocked(retailDebtRemindersApi.runNow).mockResolvedValue({}); vi.mocked(retailDebtRemindersApi.retry).mockResolvedValue({}); });

describe("RetailDebtRemindersPage", () => {
  it("shows run history, details and eligible retry", async () => { render(<RetailDebtRemindersPage />); fireEvent.click(await screen.findByText("2026-08-12")); expect(await screen.findByText("a@example.com")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); await waitFor(() => expect(retailDebtRemindersApi.retry).toHaveBeenCalledWith("d1", { companyCode: "ACME", branchId: "B1" })); });
  it("supports manual run and empty state", async () => { vi.mocked(retailDebtRemindersApi.listRuns).mockResolvedValueOnce({ items: [], total: 0 }); render(<RetailDebtRemindersPage />); expect(await screen.findByText("Chưa có lần chạy nào.")).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Chạy ngay" })); await waitFor(() => expect(retailDebtRemindersApi.runNow).toHaveBeenCalled()); });
  it("shows loading and errors", async () => { let reject!: (error: Error) => void; vi.mocked(retailDebtRemindersApi.listRuns).mockReturnValue(new Promise((_resolve, rejectFn) => { reject = rejectFn; })); render(<RetailDebtRemindersPage />); expect(screen.getByText("Đang tải...")).toBeTruthy(); reject(new Error("Không tải được")); expect(await screen.findByText("Không tải được")).toBeTruthy(); });
});
