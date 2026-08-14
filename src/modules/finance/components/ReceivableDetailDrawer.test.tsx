// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeReceivablesApi } from "../api/financeReceivables.api";
import ReceivableDetailDrawer from "./ReceivableDetailDrawer";
vi.mock("../api/financeReceivables.api", () => ({ financeReceivablesApi: { detail: vi.fn(), collect: vi.fn(), adjust: vi.fn(), writeOff: vi.fn(), suspend: vi.fn(), extend: vi.fn(), reverse: vi.fn() } }));
const detail = { receivable: { _id: "r1", receivableCode: "CN-1", customerId: "c1", customerName: "Lan", sourceCode: "DH-1", sourceType: "retail_order", sourceId: "o1", dueDate: "2026-07-01", originalAmount: 100_000, paidAmount: 20_000, adjustedAmount: 0, balance: 80_000, status: "partially_paid", daysOverdue: 42, reminderCount: 1 }, entries: [{ _id: "e1", type: "charge", amount: 100_000, runningBalance: 100_000, reason: "Mở nợ", createdAt: "2026-07-01T00:00:00Z" }] };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(financeReceivablesApi.detail).mockResolvedValue(detail as any); });

describe("ReceivableDetailDrawer", () => {
  it("renders immutable ledger and source without edit or delete controls", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:read"]} onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText("DH-1")).toBeTruthy();
    expect(screen.getByText(/Mở nợ/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /sửa bút toán/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /xóa bút toán/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /đảo bút toán/i })).toBeNull();
  });

  it("exposes permission-scoped commands with bounded amounts and required audit fields", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage", "finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    expect(await screen.findByRole("button", { name: "Thu tiền" })).toBeTruthy();
    expect(screen.getByLabelText("Số tiền thu").getAttribute("max")).toBe("80000");
    expect((screen.getByLabelText("Lý do điều chỉnh") as HTMLInputElement).required).toBe(true);
    expect(screen.getByLabelText("Gia hạn đến ngày").getAttribute("min")).toBe("2026-07-02");
    expect(screen.getByRole("button", { name: /đảo bút toán/i })).toBeTruthy();
  });

  it("shows a visible label for every receivable command field", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage", "finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    await screen.findByRole("button", { name: "Thu tiền" });

    for (const name of [
      "Số tiền thu",
      "Mã tham chiếu",
      "Số tiền điều chỉnh",
      "Hướng điều chỉnh",
      "Lý do điều chỉnh",
      "Gia hạn đến ngày",
      "Lý do gia hạn",
      "Lý do đảo bút toán",
    ]) {
      const control = screen.getByLabelText(name);
      expect(control.closest("label")?.textContent).toContain(name);
    }
  });

  it("formats VND amounts and submits integer values", async () => {
    vi.mocked(financeReceivablesApi.collect).mockResolvedValue({} as any);
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage", "finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    const amount = await screen.findByLabelText("Số tiền thu");
    fireEvent.change(amount, { target: { value: "75.000" } });
    expect((amount as HTMLInputElement).value).toBe("75.000");
    fireEvent.submit(screen.getByRole("button", { name: "Thu tiền" }).closest("form")!);
    await waitFor(() => expect(financeReceivablesApi.collect).toHaveBeenCalledWith("r1", expect.objectContaining({ amount: 75_000 })));

    const adjustment = screen.getByLabelText("Số tiền điều chỉnh");
    fireEvent.change(adjustment, { target: { value: "1.500.000" } });
    expect((adjustment as HTMLInputElement).value).toBe("1.500.000");
  });

  it("does not submit a collection above the outstanding balance", async () => {
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    const amount = await screen.findByLabelText("Số tiền thu");
    fireEvent.change(amount, { target: { value: "80.001" } });
    fireEvent.submit(screen.getByRole("button", { name: "Thu tiền" }).closest("form")!);
    expect(financeReceivablesApi.collect).not.toHaveBeenCalled();
  });

  it("extends the real due date, hides write-off, and localizes immutable history", async () => {
    vi.mocked(financeReceivablesApi.extend).mockResolvedValue({} as any);
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage", "finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText(/Phát sinh công nợ/);
    expect(screen.queryByText("Xóa nợ")).toBeNull();
    fireEvent.change(screen.getByLabelText("Gia hạn đến ngày"), { target: { value: "2026-08-30" } });
    fireEvent.change(screen.getByLabelText("Lý do gia hạn"), { target: { value: "Khách hẹn cuối tháng" } });
    fireEvent.submit(screen.getByRole("button", { name: "Gia hạn công nợ" }).closest("form")!);
    await waitFor(() => expect(financeReceivablesApi.extend).toHaveBeenCalledWith("r1", expect.objectContaining({
      dueDate: "2026-08-30T23:59:59.999Z",
      reason: "Khách hẹn cuối tháng",
    })));
  });

  it("hides collection and write-off controls after the receivable is settled", async () => {
    vi.mocked(financeReceivablesApi.detail).mockResolvedValue({ ...detail, receivable: { ...detail.receivable, balance: 0, paidAmount: 100, status: "settled" } } as any);
    render(<ReceivableDetailDrawer id="r1" permissions={["finance:manage", "finance:manage"]} onClose={() => {}} onChanged={() => {}} />);
    await screen.findByText("CN-1");
    expect(screen.queryByRole("button", { name: "Thu tiền" })).toBeNull();
    expect(screen.queryByText("Xóa nợ")).toBeNull();
    expect(screen.queryByRole("button", { name: /Đảo bút toán/i })).toBeNull();
  });
});
