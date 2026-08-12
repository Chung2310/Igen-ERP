// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeReceivablesApi } from "../api/financeReceivables.api";
import ReceivableDetailDrawer from "./ReceivableDetailDrawer";
vi.mock("../api/financeReceivables.api", () => ({ financeReceivablesApi: { detail: vi.fn(), collect: vi.fn(), adjust: vi.fn(), writeOff: vi.fn(), suspend: vi.fn(), reverse: vi.fn() } }));
const detail = { receivable: { _id: "r1", receivableCode: "CN-1", customerId: "c1", customerName: "Lan", sourceCode: "DH-1", sourceType: "retail_order", sourceId: "o1", dueDate: "2026-07-01", originalAmount: 100, paidAmount: 20, adjustedAmount: 0, balance: 80, status: "partially_paid", daysOverdue: 42, reminderCount: 1 }, entries: [{ _id: "e1", type: "charge", amount: 100, runningBalance: 100, reason: "Mở nợ", createdAt: "2026-07-01T00:00:00Z" }] };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(financeReceivablesApi.detail).mockResolvedValue(detail as any); });

describe("ReceivableDetailDrawer", () => {
  it("renders immutable ledger and source without edit or delete controls", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["receivable:read"]} onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText("DH-1")).toBeTruthy();
    expect(screen.getByText(/Mở nợ/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sửa bút toán/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /xóa bút toán/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /đảo bút toán/i })).toBeNull();
  });

  it("exposes permission-scoped commands with bounded amounts and required audit fields", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["receivable:collect", "receivable:adjust"]} onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByRole("button", { name: "Thu tiền" })).toBeTruthy();
    expect(screen.getByLabelText("Số tiền thu").getAttribute("max")).toBe("80");
    expect((screen.getByLabelText("Lý do điều chỉnh") as HTMLInputElement).required).toBe(true);
    expect(screen.getByLabelText("Tạm dừng đến ngày").getAttribute("min")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByRole("button", { name: /đảo bút toán/i })).toBeTruthy();
  });
});
