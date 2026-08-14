// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeRemindersApi } from "../api/financeReminders.api";
import FinanceRemindersPage from "./FinanceRemindersPage";
vi.mock("../api/financeReminders.api", () => ({ financeRemindersApi: { listRuns: vi.fn(), getRun: vi.fn(), runNow: vi.fn(), retry: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(financeRemindersApi.listRuns).mockResolvedValue([{ _id: "run1", businessDate: "2026-08-12", trigger: "manual", status: "completed", eligible: 2, queued: 1, skipped: 0, failed: 1, duplicates: 0, startedAt: "2026-08-12T01:00:00Z" }]); vi.mocked(financeRemindersApi.getRun).mockResolvedValue({ _id: "run1", businessDate: "2026-08-12", trigger: "manual", status: "completed", eligible: 2, queued: 1, skipped: 0, failed: 1, duplicates: 0, startedAt: "2026-08-12T01:00:00Z", deliveries: [{ _id: "d1", channel: "marketing", status: "failed", attempt: 1, maxAttempts: 5, error: "timeout", createdAt: "2026-08-12T01:00:00Z" }] }); });

describe("FinanceRemindersPage", () => {
  it("opens run deliveries and allows adjusters to retry failures and run manually", async () => {
    render(<FinanceRemindersPage permissions={["finance:manage"]} />);
    fireEvent.click(await screen.findByRole("button", { name: /2026-08-12/ }));
    expect(await screen.findByText("timeout")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry d1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chạy nhắc nợ" })).toBeTruthy();
  });

  it("keeps operational commands hidden for read-only users", async () => {
    render(<FinanceRemindersPage permissions={["finance:read"]} />);
    expect(await screen.findByRole("button", { name: /2026-08-12/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Chạy nhắc nợ" })).toBeNull();
  });
});
