// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { retailSettingsApi } from "../api/retailSettings.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { customerApi } from "../../customer-management/customerApi";
import { inventorySerialService } from "../../../services/inventorySerialService";
import { companyPaymentApi } from "../../../services/companyPaymentService";
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
vi.mock("../api/retailProducts.api", () => ({ retailProductsApi: { list: vi.fn(), categories: vi.fn() } }));
vi.mock("../api/retailShifts.api", () => ({ retailShiftsApi: { current: vi.fn().mockResolvedValue({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open" }), resume: vi.fn(), close: vi.fn() } }));
vi.mock("../../../services/retailWarrantyService", () => ({ retailWarrantyService: { lookup: vi.fn() } }));
vi.mock("../api/retailOrders.api", () => ({ retailOrdersApi: { list: vi.fn(), quote: vi.fn(), createDraft: vi.fn(), updateDraft: vi.fn(), confirm: vi.fn(), idempotency: vi.fn(), paymentQr: vi.fn(), detail: vi.fn(), cancel: vi.fn() } }));
vi.mock("../api/retailInvoices.api", () => ({ retailInvoicesApi: { detail: vi.fn() } }));
vi.mock("../api/retailSettings.api", () => ({ retailSettingsApi: { printConfig: vi.fn() } }));
vi.mock("../../../services/inventorySerialService", () => ({ inventorySerialService: { list: vi.fn() } }));
vi.mock("../../../services/companyPaymentService", () => ({ companyPaymentApi: { getVietqr: vi.fn() } }));
vi.mock("../offline/retailOfflineQueue", () => ({
  createIndexedDbRetailOfflineQueue: () => {
    const items = new Map<string, any>();
    return {
      async put(item: any) { items.set(item.id, structuredClone(item)); },
      async list(scope: any) { return [...items.values()].filter((item) => item.companyCode === scope.companyCode && item.branchId === scope.branchId && item.userId === scope.userId).map((item) => structuredClone(item)); },
      async claimNext(scope: any) { const item = [...items.values()].find((row) => row.companyCode === scope.companyCode && row.branchId === scope.branchId && row.userId === scope.userId && row.status === "pending"); if (!item) return null; item.status = "syncing"; return structuredClone(item); },
      async update(id: string, patch: any) { const item = items.get(id); if (item) items.set(id, { ...item, ...patch }); },
      async remove(id: string) { items.delete(id); },
    };
  },
  createRetailOfflineOrder: (scope: any, payload: any, idempotencyKey: string) => ({ id: crypto.randomUUID(), ...scope, payload, idempotencyKey, status: "pending", attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
}));
vi.mock("../offline/retailCheckoutLock", () => ({ withRetailCheckoutLock: (_scope: any, work: () => Promise<unknown>) => work() }));
vi.mock("../components/pos/HeldDraftsBar", () => ({ default: () => null }));
vi.mock("../components/pos/BarcodeScannerDialog", () => ({ default: () => null }));
vi.mock("../components/pos/CustomerPicker", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ _id: "c1", customerCode: "KH-1", companyCode: "ACME", type: "vat", name: "An" })}>Chọn khách An</button> }));
vi.mock("../components/pos/DiscountInput", () => ({ default: ({ label, onChange }: any) => <button onClick={() => onChange({ type: "percent", value: 10 })}>{label}</button> }));
vi.mock("../components/pos/OrderAdjustments", () => ({ default: ({ onChange }: any) => <button onClick={() => onChange({ orderDiscount: { type: "amount", value: 5_000 }, taxRate: 8, shippingFee: 20_000 })}>Điều chỉnh đơn</button> }));
vi.mock("../components/pos/PaymentDialog", () => ({ default: ({ onSubmit }: any) => <div data-testid="payment-dialog"><button onClick={() => onSubmit([{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }])}>Gửi thanh toán</button><button onClick={() => onSubmit([{ method: "transfer", amount: 209_000 }])}>Tạo QR chuyển khoản</button><button onClick={() => onSubmit([], "2026-09-30")}>Gửi ghi nợ toàn bộ</button></div> }));

const product = { _id: "p1", sku: "SKU-1", name: "Áo", category: "A", unit: "cái", stock: 10, price: 100_000 };
const order = { _id: "o1", orderCode: "DH-1", status: "completed", paymentStatus: "paid", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, paidAmount: 209_000, dueAmount: 0, version: 1, createdBy: "u1", createdByName: "Thu ngân" } as any;
const invoice = { _id: "i1", invoiceNo: "HD-1", orderId: "o1", orderCode: "DH-1", issuedAt: "2026-08-10T08:00:00Z", status: "issued", snapshot: { customerName: "An", cashierName: "Thu ngân", items: [], subtotal: 180_000, orderDiscount: 5_000, taxRate: 8, taxAmount: 14_000, shippingFee: 20_000, grandTotal: 209_000, payments: [], amountInWords: "" } } as any;

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("print", vi.fn());
  vi.mocked(retailShiftsApi.resume).mockImplementation(async (_scope, _id, terminalId) => ({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open", terminalId }));
  vi.mocked(retailShiftsApi.close).mockResolvedValue({ _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "closed" } as any);
  vi.stubGlobal("indexedDB", {});
  const checkoutLocks = { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}) };
  vi.stubGlobal("navigator", new Proxy(navigator, { get: (target, property) => property === "locks" ? checkoutLocks : Reflect.get(target, property, target) }));
  if (typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal !== "function") {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
  }
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([{ _id: "bp1", customerId: "c1", legalName: "Cong ty A", taxId: "0312345678", address: "1 Nguyen Hue", invoiceEmail: "a@example.com", isDefault: true, status: "active", version: 1 }] as any);
  vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 500 });
  vi.mocked(retailProductsApi.categories).mockResolvedValue([]);
  vi.mocked(retailOrdersApi.list).mockResolvedValue({ items: [], total: 0, page: 1, limit: 5 });
  vi.mocked(retailOrdersApi.quote).mockResolvedValue({ subtotal: 180_000, grandTotal: 209_000 });
  vi.mocked(retailOrdersApi.createDraft).mockResolvedValue({ ...order, status: "draft" });
  vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order, invoice });
  vi.mocked(retailInvoicesApi.detail).mockResolvedValue(invoice);
  vi.mocked(retailSettingsApi.printConfig).mockResolvedValue({ invoicePaperSize: "80mm", invoiceTemplate: "standard", defaultTaxRate: 0, storeName: "ACME" });
  vi.mocked(retailOrdersApi.idempotency).mockResolvedValue(null as any);
  vi.mocked(companyPaymentApi.getVietqr).mockResolvedValue({ bankId: "BANK", accountNo: "0123", accountName: "Igen" });
});

describe("RetailPosPage", () => {
  it("closes a shift from the POS dialog after entering counted cash", async () => {
    const onManageShift = vi.fn();
    render(<RetailPosPage onManageShift={onManageShift} />);
    await userEvent.click(await screen.findByRole("button", { name: "Đóng phiên" }));
    expect(screen.getByRole("dialog", { name: "Kiểm đếm và đóng ca" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Gửi kiểm đếm và đóng ca" }));
    expect(screen.getByRole("alert").textContent).toContain("Nhập số tiền");
    expect(retailShiftsApi.close).not.toHaveBeenCalled();
    await userEvent.type(screen.getByRole("spinbutton", { name: "Tiền thực đếm" }), "100000");
    await userEvent.click(screen.getByRole("button", { name: "Gửi kiểm đếm và đóng ca" }));
    await waitFor(() => expect(retailShiftsApi.close).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "s1", { countedCash: 100000, varianceReason: undefined }));
    expect(onManageShift).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Chưa có ca bán hàng" })).toBeTruthy();
  });
  it("waits for a manager to open the shift before using POS", async () => {
    const onManageShift = vi.fn();
    vi.mocked(retailShiftsApi.current).mockResolvedValueOnce(null);
    render(<RetailPosPage onManageShift={onManageShift} />);
    expect(await screen.findByRole("heading", { name: "Chưa có ca bán hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Quản lý ca" }));
    expect(onManageShift).toHaveBeenCalledOnce();
  });

  it("requires taking over a session that is open on another terminal", async () => {
    const otherTerminalShift = { _id: "s1", shiftCode: "CA-1", cashierId: "u1", cashierName: "Thu ngân", openingFloat: 0, businessDate: "2026-08-10", status: "open", terminalId: "other-terminal" } as any;
    vi.mocked(retailShiftsApi.current).mockResolvedValueOnce(otherTerminalShift);
    vi.mocked(retailShiftsApi.resume).mockImplementation(async (_scope, _id, terminalId) => ({ ...otherTerminalShift, terminalId }));
    render(<RetailPosPage />);
    expect(await screen.findByRole("heading", { name: "Phiên đang mở trên máy khác" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thanh toán" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Tiếp tục trên máy này" }));
    expect(await screen.findByRole("button", { name: "Thanh toán" })).toBeTruthy();
    expect(retailShiftsApi.resume).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "s1", expect.any(String));
  });

  it("allows a walk-in customer to pay a fully paid order", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));

    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    expect(screen.getByTestId("payment-dialog")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Gửi thanh toán" }));

    await waitFor(() => expect(retailOrdersApi.createDraft).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, expect.not.objectContaining({ customerId: expect.anything() })));
    await waitFor(() => expect(retailOrdersApi.confirm).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "o1", expect.objectContaining({ pendingTransfer: false, payments: [{ method: "cash", amount: 209_000, tenderedAmount: 220_000 }] })));
    await waitFor(() => expect(window.print).toHaveBeenCalledOnce());
  });

  it("starts a new cart with the branch default tax rate", async () => {
    vi.mocked(retailSettingsApi.printConfig).mockResolvedValue({ invoicePaperSize: "80mm", invoiceTemplate: "standard", defaultTaxRate: 8, storeName: "ACME" });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ taxRate: 8 })));
  });

  it("saves sale note and installment settings with a held order", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Chọn khách An" }));
    await userEvent.click(screen.getByRole("button", { name: "Ghi chú" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ghi chú đơn hàng" }), "Giao buổi chiều");
    await userEvent.click(screen.getByRole("button", { name: "Xong" }));
    await userEvent.click(screen.getByRole("button", { name: "Trả góp" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Bán trả góp" }));
    await userEvent.click(screen.getByRole("button", { name: "Xong" }));
    await userEvent.click(screen.getByRole("button", { name: "Treo đơn" }));
    await waitFor(() => expect(retailOrdersApi.createDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      note: "Giao buổi chiều", installment: { partner: "HD Saison", months: 6, prepayPercent: 20 },
    })));
  });

  it("keeps QR transfer pending until the payment provider confirms it", async () => {
    const pendingOrder = { ...order, status: "confirmed", paymentStatus: "unpaid", paidAmount: 0, dueAmount: 209_000 } as any;
    vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order: pendingOrder, invoice });
    vi.mocked(retailOrdersApi.paymentQr).mockResolvedValue({ orderId: "o1", qrUrl: "https://example.test/qr.png", paymentCode: "DH1", amount: 209_000, accountName: "Igen", accountNumber: "0123", bankId: "BANK" } as any);
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(await screen.findByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Tạo QR chuyển khoản" }));

    expect(await screen.findByRole("dialog", { name: "Chờ thanh toán QR" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "QR chuyển khoản đơn DH-1" })).toBeTruthy();
    expect(retailOrdersApi.confirm).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "o1", expect.objectContaining({ pendingTransfer: true, payments: [] }));
  });

  it("opens the completed invoice and prints after the QR payment is confirmed", async () => {
    const pendingOrder = { ...order, status: "confirmed", paymentStatus: "unpaid", paidAmount: 0, dueAmount: 209_000, pendingTransferAmount: 209_000 } as any;
    vi.mocked(retailOrdersApi.confirm).mockResolvedValue({ order: pendingOrder, invoice });
    vi.mocked(retailOrdersApi.paymentQr).mockResolvedValue({ orderId: "o1", qrUrl: "https://example.test/qr.png", paymentCode: "DH1", amount: 209_000, accountName: "Igen", accountNumber: "0123", bankId: "BANK" } as any);
    vi.mocked(retailOrdersApi.detail).mockResolvedValue({ ...order, pendingTransferAmount: 0 });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Thanh toán" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.click(screen.getByRole("button", { name: "Tạo QR chuyển khoản" }));
    expect(await screen.findByRole("dialog", { name: "Chờ thanh toán QR" })).toBeTruthy();
    expect(await screen.findByRole("dialog", { name: "Thanh toán thành công" }, { timeout: 5_000 })).toBeTruthy();
    await waitFor(() => expect(window.print).toHaveBeenCalledOnce());
    expect(retailInvoicesApi.detail).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, "i1");
  });

  it("selects a serial before adding a tracked product to the cart", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [{ ...product, trackingMode: "serial", productId: "base1", variantId: "v1" } as any], total: 1, page: 1, limit: 500 });
    vi.mocked(inventorySerialService.list).mockResolvedValue({ items: [{ _id: "u1", serialNumber: "IMEI001", normalizedSerialNumber: "IMEI001" }] as any, total: 1, page: 1, limit: 100 } as any);
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    expect(await screen.findByRole("dialog", { name: "Chọn IMEI / Serial để thêm vào giỏ" })).toBeTruthy();
    expect(screen.queryByLabelText("Số lượng Áo")).toBeNull();
    await userEvent.click(await screen.findByRole("radio", { name: "IMEI001" }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm vào giỏ" }));
    await waitFor(() => expect(retailOrdersApi.quote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ items: [expect.objectContaining({ quantity: 1, serialNumbers: ["IMEI001"] })] })));
  });

  it("navigates the inventory category tree and filters child SKUs", async () => {
    vi.mocked(retailProductsApi.categories).mockResolvedValue([
      { code: "ROOT", name: "Hàng hóa" },
      { code: "PHONE", name: "Điện thoại", parentCode: "ROOT" },
      { code: "APPLE", name: "Apple", parentCode: "PHONE" },
      { code: "ACCESSORY", name: "Phụ kiện", parentCode: "ROOT" },
    ]);
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [
      { ...product, _id: "phone", productId: "phone-product", name: "iPhone", category: "APPLE" },
      { ...product, _id: "case", productId: "case-product", name: "Ốp lưng", category: "ACCESSORY" },
    ], total: 2, page: 1, limit: 500 });
    render(<RetailPosPage />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Hàng hóa" })).at(-1)!);
    await userEvent.click(screen.getByRole("group", { name: "Danh mục mức 2" }).querySelector<HTMLButtonElement>("button:nth-child(2)")!);
    await userEvent.click(screen.getByRole("group", { name: "Danh mục mức 3" }).querySelector<HTMLButtonElement>("button:nth-child(2)")!);
    expect(await screen.findByText("iPhone")).toBeTruthy();
    expect(screen.queryByText("Ốp lưng")).toBeNull();
  });

  it("groups the unfiltered catalog into inventory folders", async () => {
    vi.mocked(retailProductsApi.categories).mockResolvedValue([{ code: "PHONE", name: "Điện thoại" }]);
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [{ ...product, category: "PHONE" }], total: 1, page: 1, limit: 500 });
    render(<RetailPosPage />);
    const folders = await screen.findByLabelText("Thư mục sản phẩm");
    const folder = folders.querySelector("details");
    expect(folder?.open).toBe(false);
    await userEvent.click(folder!.querySelector("summary")!);
    expect(folder?.open).toBe(true);
    expect(folders.querySelector("button")?.textContent).toContain("Áo");
  });

  it("filters product cards by brand", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [
      { ...product, _id: "apple", productId: "apple", name: "iPhone", brand: "Apple" },
      { ...product, _id: "samsung", productId: "samsung", name: "Galaxy", brand: "Samsung" },
    ], total: 2, page: 1, limit: 500 });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Apple" }));
    expect(screen.getByText("iPhone")).toBeTruthy();
    expect(screen.queryByText("Galaxy")).toBeNull();
  });

  it("opens a variant dialog before adding a product with multiple SKUs", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [
      { ...product, _id: "v1", productId: "base", sku: "SKU-1", variantName: "Đen" },
      { ...product, _id: "v2", productId: "base", sku: "SKU-2", variantName: "Trắng" },
    ], total: 2, page: 1, limit: 500 });
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    expect(await screen.findByRole("dialog", { name: "Chọn phiên bản Áo" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Trắng, tồn/ }));
    expect(await screen.findByLabelText("Số lượng Áo")).toBeTruthy();
  });

  it("toggles full screen without clearing the current cart", async () => {
    render(<RetailPosPage />);
    await userEvent.click(await screen.findByRole("button", { name: /SKU-1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Toàn màn hình" }));
    expect(screen.getByRole("button", { name: "Thoát toàn màn hình" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Số lượng Áo") as HTMLInputElement).value).toBe("1");
  });

  it("shows zero-stock products and warns when the cashier tries to add one", async () => {
    vi.mocked(retailProductsApi.list).mockResolvedValue({ items: [{ ...product, stock: 0 }], total: 1, page: 1, limit: 500 });
    render(<RetailPosPage />);
    expect(await screen.findByText(/Hết hàng/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /SKU-1/ }));
    expect(toast.error).toHaveBeenCalledWith("Áo không còn đủ tồn khả dụng.");
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
    await userEvent.click(screen.getByRole("button", { name: "Giảm giá" }));
    await userEvent.click(screen.getByRole("button", { name: "Điều chỉnh đơn" }));
    await userEvent.click(screen.getByRole("button", { name: "Xong" }));

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
