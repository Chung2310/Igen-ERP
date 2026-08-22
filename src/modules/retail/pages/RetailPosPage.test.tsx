// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { customerApi } from "../../customer-management/customerApi";
import RetailPosPage from "./RetailPosPage";
import { toast } from "../../../pages/Toast";

vi.mock("../../../pages/Toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}));

vi.mock("../hooks/useRetailScope", () => ({ useRetailScope: () => ({ scope: { companyCode: "ACME", branchId: "B1" }, userProfile: { uid: "u1" } }) }));
vi.mock("../../customer-management/customerApi", () => ({ customerApi: { billingProfiles: vi.fn() } }));
vi.mock("../api/retailProducts.api", () => ({ retailProductsApi: { list: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn().mockResolvedValue({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open" }) } }));
vi.mock("../../../services/retailWarrantyService", () => ({ retailWarrantyService: { lookup: vi.fn() } }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { list: vi.fn(), quote: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn(), idempotency: vi.fn(), cancel: vi.fn() } }));
vi.mock("../components/pos/HeldDraftsBar", () => ({ default: () => null }));
vi.mock("../components/pos/BarcodeScannerDialog", () => ({ default: () => null }));
vi.mock("../components/pos/CustomerPicker", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ _id: "c1", customerCode: "KH-1", companyCode: "ACME", type: "vat", name: "An" })}>Chọn khách An</button> }));
vi.mock("../components/pos/DiscountInput", () => ({ default: ({ label, onChange }: any) => <button onClick={() => onChange({ type: "percent", value: 10 })}>{label}</button> }));
vi.mock("../components/pos/OrderAdjustments", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000 })}>Điều chỉnh đơn</button> }));
vi.mock("../components/pos/PaymentDialog", () => ({ default: ({ onSubmit }: any) => <div data-testid="payment-dialog"><button onClick={() => onSubmit([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }])}>Gửi thanh toán</button><button onClick={() => onSubmit([], "2026-09-30")}>Gửi ghi nợ toàn bộ</button></div> }));

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };
const order = { _id: "o1", orderCode: "DH-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, paidAmount: 209_000, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" } as any;
const invoice = { _id: "i1", invoiceNo: "HD-1", orderId: "o1", orderCode: "DH-1", issuedAt: "2026-08-10T08:00:00Z", status: "issued", snapshot: { customerName: "An", cashierName: "Thu ngân", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, payments: [], amountInWords: "" } } as any;

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([{ _id: "bp1", customerId: "c1", legalName: "Cong ty A", taxId: "0312345678", address: "1 Nguyen Hue", invoiceEmail: "a@example.com", isDefault: true, status: "active", version: 1 }] as any);
  vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 500 });
  vi.mocked(retailOrdersApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 5 });
  vi.mocked(retailOrdersApi.quote).mockResolvedValue({ subtotal: 180_000, grandTotal: 209_000 });
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ ...order, status: "draft" });
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order, invoice });
});

describe("RetailPosPage", () => {
  it("guides cashier to open a shift before using POS", async () => {
    const open = vi.fn().mockResolvedValue({ _id: "s2", shiftCode: "CA-2", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 500_000, businessDate: "2026-08-10", status: "open" });
    (retailShiftsApi as any).open = open;
    vi.mocked(retailShiftsApi.current).mockResolvedValueOnce(null);
    render(<RetailPosPage />);

    expect(await screen.findByRole("heading", { name: "Mở ca bán hàng" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Tiền đầu ca"), "500000");
    await userEvent.click(screen.getByRole("button", { name: "Mở ca ngay" }));

    await waitFor(() => expect(open).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, { openingFloat: 500_000, terminalId: undefined }));
    expect(await screen.findByText(/CA-2/)).toBeTruthy();
  });

  it("keeps payment dialog closed and guides cashier to select a customer", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));

    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));

    expect(screen.queryByTestId("payment-dialog")).toBeNull();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Vui lòng chọn khách hàng trước khi thanh toán."));
  });

  it("adds the first search result on Enter without treating the text as a barcode scan", async () => {
    render(<RetailPosPage />);
    const search = await screen.findByRole("textbox", { name: "Tìm hoặc quét sản phẩm" });

    await userEvent.type(search, "ÁO");
    await waitFor(() => expect(retailProductsApi.list).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "B1" },
      { q: "ÁO", limit: 500 },
    ));
    await userEvent.keyboard("{Enter}");

    expect((await screen.findByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
    expect(retailWarrantyService.lookup).not.toHaveBeenCalled();
    expect(screen.queryByText("Không tìm thấy sản phẩm")).toBeNull();
  });

  it("carries customer, VAT profile and adjustments through quote and checkout to receipt", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Áo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await userEvent.click(screen.getByRole("button", { name: "Giảm giá Áo" }));
    await userEvent.click(screen.getByRole("button", { name: "Điều chỉnh đơn" }));

    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, {
      items: [{ productId: "p1", quantity: 1, discount: { type: "percent", value: 10 } }], customerId: "c1", billingProfileId: "bp1",
      orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000,
    }));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));
    expect(await screen.findByRole("dialog", { name: "Thanh toán thành công" })).toBeTruthy();
    expect(screen.getByText("HD-1")).toBeTruthy();
  });

  it("creates a customer debt draft with VAT profile and confirms with no collected payments", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Gửi ghi nợ toàn bộ" }));

    await waitFor(() => expect(retailOrdersApi.createDraft).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.objectContaining({ customerId: "c1", billingProfileId: "bp1", dueDate: "2026-09-30" })));
    expect(retailOrdersApi.confirm).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "o1", expect.objectContaining({ payments: [] }));
  });
});
