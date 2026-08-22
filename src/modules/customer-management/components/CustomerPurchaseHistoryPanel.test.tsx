// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../customerApi";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";

vi.mock("../customerApi", () => ({ customerApi: { purchaseHistory: vi.fn() } }));

const history = {
  summary: { orderCount: 2, totalPurchased: 150000, totalPaid: 120000, currentDebt: 30000, lastPurchaseAt: "2026-08-20T00:00:00.000Z" },
  items: [{ _id: "order123", orderCode: "SO-001", status: "confirmed", businessDate: "2026-08-20T00:00:00.000Z", grandTotal: 150000, paidAmount: 120000, dueAmount: 30000, itemCount: 3, salespersonName: "Minh" }],
};

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("CustomerPurchaseHistoryPanel", () => {
  it("asks for a branch without requesting history", () => {
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" />);

    expect(screen.getByText("Vui lòng chọn chi nhánh để xem lịch sử mua hàng.")).toBeTruthy();
    expect(customerApi.purchaseHistory).not.toHaveBeenCalled();
  });

  it("shows loading then branch-scoped summary and orders", async () => {
    let resolveHistory!: (value: typeof history) => void;
    vi.mocked(customerApi.purchaseHistory).mockReturnValueOnce(new Promise((resolve) => { resolveHistory = resolve; }));
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(screen.getByText("Đang tải lịch sử mua hàng...")).toBeTruthy();
    expect(customerApi.purchaseHistory).toHaveBeenCalledWith("c1", { companyCode: "IGEN", branchId: "B1" });
    resolveHistory(history);

    await waitFor(() => expect(screen.getByText("Số đơn")).toBeTruthy());
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Tổng đã mua")).toBeTruthy();
    expect(screen.getAllByText(/150\.000\s*₫/).length).toBeGreaterThan(0);
    expect(screen.getByText("SO-001")).toBeTruthy();
    expect(screen.getByText(/Đã xác nhận/)).toBeTruthy();
    expect(screen.getByText(/3 sản phẩm/)).toBeTruthy();
    expect(screen.getByText(/Nhân viên: Minh/)).toBeTruthy();
  });

  it("shows an empty state after a successful request", async () => {
    vi.mocked(customerApi.purchaseHistory).mockResolvedValueOnce({ summary: { orderCount: 0, totalPurchased: 0, totalPaid: 0, currentDebt: 0 }, items: [] });
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("Khách hàng chưa có đơn mua tại chi nhánh này.")).toBeTruthy();
  });

  it("shows the request error", async () => {
    vi.mocked(customerApi.purchaseHistory).mockRejectedValueOnce(new Error("Mất kết nối"));
    render(<CustomerPurchaseHistoryPanel customerId="c1" companyCode="IGEN" branchId="B1" />);

    expect(await screen.findByText("Mất kết nối")).toBeTruthy();
  });
});
