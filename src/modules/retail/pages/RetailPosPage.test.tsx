// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { customerApi } from "../../customer-management/customerApi";
import { checkoutWithPersistedIntent } from "../offline/checkoutIntent";
import { createIndexedDbRetailOfflineQueue } from "../offline/retailOfflineQueue";
import RetailPosPage from "./RetailPosPage";
import { toast } from "../../../pages/Toast";

vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "u1" } }) }));
vi.mock("../../customer-management/customerApi", () => ({ customerApi: { billingProfiles: vi.fn() } }));
vi.mock("../api/retailProducts.api", () => ({ retailProductsApi: { list: vi.fn() } }));
vi.mock("../api/retailSettings.api", () => ({ retailSettingsApi: { printConfig: vi.fn().mockResolvedValue({ invoicePaperSize: "80mm", defaultTaxRate: 0 }) } }));
vi.mock("../api/retailInvoices.api", () => ({ retailInvoicesApi: { registerPosPrint: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("../../../services/retailWarrantyService", () => ({ retailWarrantyService: { lookup: vi.fn() } }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { quote: vi.fn() } }));
vi.mock("../offline/checkoutIntent", async (original) => ({ ...await original<typeof import("../offline/checkoutIntent")>(), checkoutWithPersistedIntent: vi.fn() }));
vi.mock("../offline/retailOfflineQueue", async (original) => {
  const actual = await original<typeof import("../offline/retailOfflineQueue")>();
  return { ...actual, createIndexedDbRetailOfflineQueue: vi.fn(actual.createMemoryRetailOfflineQueue) };
});
vi.mock("../components/pos/BarcodeScannerDialog", () => ({ default: () => null }));
vi.mock("../components/pos/CartPanel", () => ({
  CartPanel: ({ cart, dispatch, onPay, busy, canPay }: any) => <section>
    <button onClick={() => dispatch({ type: "customer", customer: { _id: "c1", customerCode: "KH-1", companyCode: "ACME", type: "vat", name: "An" } })}>Chọn khách An</button>
    {cart.lines.map((line: any) => <input key={line.product._id} aria-label={`Số lượng ${line.product.name}`} readOnly value={line.quantity} />)}
    <button onClick={() => dispatch({ type: "lineDiscount", productId: "p1", discount: { type: "percent", value: 10 } })}>Giảm giá Áo</button>
    <button onClick={() => dispatch({ type: "orderAdjustments", orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000 })}>Điều chỉnh đơn</button>
    <button disabled={busy || !canPay || !cart.lines.length || !cart.quote || cart.quoteDirty} onClick={onPay}>Thanh toán</button>
  </section>,
}));
vi.mock("../components/pos/PaymentDialog", () => ({ default: ({ onSubmit }: any) => <div data-testid="payment-dialog">
  <button onClick={() => onSubmit([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }])}>Gửi thanh toán</button>
  <button onClick={() => onSubmit([], "2026-09-30")}>Gửi ghi nợ toàn bộ</button>
</div> }));

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };
const order = { _id: "o1", orderCode: "DH-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, paidAmount: 209_000, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Cashier" } as any;
const invoice = { _id: "i1", invoiceNo: "HD-1", orderId: "o1", orderCode: "DH-1", issuedAt: "2026-08-10T08:00:00Z", status: "issued", snapshot: { customerName: "An", cashierName: "Cashier", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, payments: [], amountInWords: "" } } as any;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal("indexedDB", {});
  vi.spyOn(window, "print").mockImplementation(() => undefined);
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([{ _id: "bp1", customerId: "c1", legalName: "Company A", taxId: "0312345678", address: "1 Nguyen Hue", invoiceEmail: "a@example.com", isDefault: true, status: "active", version: 1 }]);
  vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 500 });
  vi.mocked(retailOrdersApi.quote).mockResolvedValue({ subtotal: 180_000, grandTotal: 209_000 });
  vi.mocked(checkoutWithPersistedIntent).mockResolvedValue({ order, invoice });
});

async function addProduct() {
  await userEvent.type(await screen.findByRole("textbox", { name: "Tìm hoặc quét sản phẩm" }), "ÁO");
  await userEvent.click(await screen.findByRole("button", { name: /^Áo SKU:/ }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
}

describe("RetailPosPage", () => {
  it("blocks checkout when no POS session has been assigned", async () => {
    render(<RetailPosPage />);
    await addProduct();
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(checkoutWithPersistedIntent).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Phiên POS chưa mở"));
  });

  it("checks out a fully paid walk-in sale through one persisted checkout intent", async () => {
    render(<RetailPosPage posSessionId="s1" />);
    await addProduct();
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(await screen.findByRole("dialog", { name: "Thanh toán thành công" })).toBeTruthy();
    const call = vi.mocked(checkoutWithPersistedIntent).mock.calls[0];
    expect(call[0]).toMatchObject({ companyCode: "ACME", branchId: "B1", userId: "u1" });
    expect(call[2]).not.toHaveProperty("customerId");
    expect(call[3]).toEqual([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }]);
    expect(call[5]).toBe("s1");
    expect(retailInvoicesApi.registerPosPrint).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1");
    expect(createIndexedDbRetailOfflineQueue).toHaveBeenCalledOnce();
  });

  it("adds a search result on Enter without treating the text as a barcode", async () => {
    render(<RetailPosPage posSessionId="s1" />);
    await userEvent.type(await screen.findByRole("textbox", { name: "Tìm hoặc quét sản phẩm" }), "ÁO");
    await screen.findByRole("button", { name: /^Áo SKU:/ });
    await userEvent.keyboard("{Enter}");
    expect((await screen.findByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
    expect(retailWarrantyService.lookup).not.toHaveBeenCalled();
  });

  it("carries the selected VAT profile and discounts into quote and checkout", async () => {
    render(<RetailPosPage posSessionId="s1" />);
    await addProduct();
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await userEvent.click(screen.getByRole("button", { name: "Giảm giá Áo" }));
    await userEvent.click(screen.getByRole("button", { name: "Điều chỉnh đơn" }));
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.objectContaining({
      customerId: "c1", billingProfileId: "bp1", orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
      items: [expect.objectContaining({ productId: "p1", quantity: 1, discount: { type: "percent", value: 10 } })],
    })));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    await waitFor(() => expect(checkoutWithPersistedIntent).toHaveBeenCalledOnce());
    expect(vi.mocked(checkoutWithPersistedIntent).mock.calls[0][2]).toMatchObject({ customerId: "c1", billingProfileId: "bp1", taxRate: 8, shippingFee: 20_000 });
  });

  it("includes the customer, VAT profile and due date when recording full debt", async () => {
    render(<RetailPosPage posSessionId="s1" />);
    await addProduct();
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ billingProfileId: "bp1" })));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi ghi nợ toàn bộ" }));
    await waitFor(() => expect(checkoutWithPersistedIntent).toHaveBeenCalledOnce());
    const call = vi.mocked(checkoutWithPersistedIntent).mock.calls[0];
    expect(call[2]).toMatchObject({ customerId: "c1", billingProfileId: "bp1", dueDate: "2026-09-30" });
    expect(call[3]).toEqual([]);
  });
});
