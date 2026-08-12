// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import RetailPosPage from "./RetailPosPage";

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "u1" } }) }));
vi.mock("../api/retailProducts.api", () => ({ retailProductsApi: { list: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn().mockResolvedValue({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open" }) } }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { list: vi.fn(), quote: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn(), idempotency: vi.fn() } }));
vi.mock("../components/pos/HeldDraftsBar", () => ({ default: () => null }));
vi.mock("../components/pos/BarcodeScannerDialog", () => ({ default: () => null }));
vi.mock("../components/pos/CustomerPicker", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ _id: "c1", customerCode: "KH-1", companyCode: "ACME", originBranchId: "B2", name: "An" })}>Chọn khách An</button> }));
vi.mock("../components/pos/DiscountInput", () => ({ default: ({ label, onChange }: any) => <button onClick={() => onChange({ type: "percent", value: 10 })}>{label}</button> }));
vi.mock("../components/pos/OrderAdjustments", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000 })}>Điều chỉnh đơn</button> }));
vi.mock("../components/pos/PaymentDialog", () => ({ default: ({ onSubmit }: any) => <button onClick={() => onSubmit([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }])}>Gửi thanh toán</button> }));

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };
const order = { _id: "o1", orderCode: "DH-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, paidAmount: 209_000, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" } as any;
const invoice = { _id: "i1", invoiceNo: "HD-1", orderId: "o1", orderCode: "DH-1", issuedAt: "2026-08-10T08:00:00Z", status: "issued", snapshot: { customerName: "An", cashierName: "Thu ngân", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, payments: [], amountInWords: "" } } as any;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 20 });
  vi.mocked(retailOrdersApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 5 });
  vi.mocked(retailOrdersApi.quote).mockResolvedValue({ subtotal: 180_000, grandTotal: 209_000 });
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ ...order, status: "draft" });
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order, invoice });
});

describe("RetailPosPage", () => {
  it("carries customer and adjustments through quote and checkout to receipt", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Áo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await userEvent.click(screen.getByRole("button", { name: "Giảm giá Áo" }));
    await userEvent.click(screen.getByRole("button", { name: "Điều chỉnh đơn" }));

    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, {
      items: [{ productId: "p1", quantity: 1, discount: { type: "percent", value: 10 } }], customerId: "c1",
      orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
    }));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(await screen.findByRole("dialog", { name: "Thanh toán thành công" })).toBeTruthy();
    expect(screen.getByText("HD-1")).toBeTruthy();
  });

  it("queues a fixed checkout after network failure without showing success", async () => {
    vi.mocked(retailOrdersApi.confirm).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.mocked(retailOrdersApi.idempotency).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(await screen.findByText("Chờ đồng bộ")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Thanh toÃ¡n thÃ nh cÃ´ng" })).toBeNull();
  });
});
