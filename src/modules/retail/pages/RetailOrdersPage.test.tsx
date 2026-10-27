// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailOrder } from "../types";
import RetailOrdersPage from "./RetailOrdersPage";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { list: vi.fn(), detail: vi.fn(), collect: vi.fn(), cancel: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { list: vi.fn() } }));

const outstandingOrder = (customerId?: string): RetailOrder => ({
  _id: "o1", orderCode: "DH-01", status: "confirmed", paymentStatus: "partial", customerName: "Nguyễn Văn A", items: [], subtotal: 500_000,
  orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 500_000, paidAmount: 0, dueAmount: 500_000, version: 1, createdBy: "u1", createdByName: "Thu ngân",
  ...(customerId ? { customerId } : {}),
});

afterEach(() => { cleanup(); delete (navigator as any).locks; });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: vi.fn(async (_name, _options, work) => work({ name: _name })),
  } });
  vi.mocked(retailShiftsApi.list).mockResolvedValue({ items: [{ _id: "507f1f77bcf86cd799439011", cashierName: "Thu ngân", businessDate: "2026-08-13", status: "open" }] as any, total: 1, page: 1, limit: 100 });
});

async function openOutstandingOrder(order: ReturnType<typeof outstandingOrder>) {
  vi.mocked(retailOrdersApi.list).mockResolvedValue({ items: [order], total: 1, page: 1, limit: 20 });
  vi.mocked(retailOrdersApi.detail).mockResolvedValue(order);
  render(<RetailOrdersPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  await screen.findByRole("heading", { name: "DH-01" });
}

describe("RetailOrdersPage", () => {
  it("collects a full payment for an outstanding customer order", async () => {
    const order = outstandingOrder("c1");
    vi.mocked(retailOrdersApi.collect).mockResolvedValue({ ...order, dueAmount: 0, paidAmount: 500_000, paymentStatus: "paid" });
    await openOutstandingOrder(order);

    await userEvent.click(screen.getByRole("button", { name: "Thu công nợ" }));
    await screen.findByRole("option", { name: "Thu ngân · 2026-08-13" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Phiên thu hoặc hoàn tiền" }), "507f1f77bcf86cd799439011");
    await userEvent.click(await screen.findByRole("button", { name: "Xác nhận thanh toán" }));

    await waitFor(() => expect(retailOrdersApi.collect).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" }, "o1", [{ method: "cash", amount: 500_000, tenderedAmount: 500_000 }],
      { cashSessionId: "507f1f77bcf86cd799439011", idempotencyKey: expect.any(String), expectedVersion: 1 },
    ));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks collection for a legacy outstanding order without a customer", async () => {
    await openOutstandingOrder(outstandingOrder());

    await userEvent.click(screen.getByRole("button", { name: "Thu công nợ" }));

    expect((await screen.findByText("Vui lòng chọn khách hàng trước khi thanh toán.")).textContent).toBe("Vui lòng chọn khách hàng trước khi thanh toán.");
    expect(screen.queryByRole("dialog", { name: "Thanh toán" })).toBeNull();
    expect(retailOrdersApi.collect).not.toHaveBeenCalled();
  });
});
