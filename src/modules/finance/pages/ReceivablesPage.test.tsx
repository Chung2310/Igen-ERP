// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeReceivablesApi } from "../api/financeReceivables.api";
import ReceivablesPage from "./ReceivablesPage";

vi.mock("../api/financeReceivables.api", () => ({ financeReceivablesApi: { list: vi.fn(), detail: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState(null, "", "/?sub=cong-no&aging=31-60"); });

describe("ReceivablesPage", () => {
  it("shows loading then empty state and forwards URL aging filter", async () => {
    let resolve!: (value: any) => void;
    vi.mocked(financeReceivablesApi.list).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ReceivablesPage permissions={["receivable:read"]} />);
    expect(screen.getByText("Đang tải công nợ...")).toBeTruthy();
    resolve({ items: [], total: 0 });
    expect(await screen.findByText("Chưa có khoản công nợ phù hợp.")).toBeTruthy();
    expect(financeReceivablesApi.list).toHaveBeenCalledWith(expect.objectContaining({ agingBucket: "31-60", page: 1 }));
  });

  it("renders overdue badge and reloads with status and pagination filters", async () => {
    vi.mocked(financeReceivablesApi.list).mockResolvedValue({ items: [{ _id: "r1", receivableCode: "CN-1", customerId: "c1", customerName: "Lan", dueDate: "2026-07-01", originalAmount: 100, paidAmount: 0, adjustedAmount: 0, balance: 100, status: "open", daysOverdue: 42, reminderCount: 1 }], total: 21 });
    render(<ReceivablesPage permissions={["receivable:read"]} />);
    expect(await screen.findByText("Quá hạn 42 ngày")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), { target: { value: "open" } });
    await waitFor(() => expect(financeReceivablesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "open", page: 1 })));
    fireEvent.click(screen.getByLabelText("Trang sau"));
    await waitFor(() => expect(financeReceivablesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});
