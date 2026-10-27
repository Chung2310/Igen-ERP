// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), listBalances: vi.fn(), canManage: false }));
vi.mock("../../modules/shared/lib/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: { listBalances: mocks.listBalances } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "user", companyCode: "QA_EDU" }, hasPermission: (code: string) => code === "inventory:manage" && mocks.canManage }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "hn", branches: [{ _id: "hn", name: "Hà Nội" }] }) }));
import { InventoryTransfersSection } from "./InventoryTransfersSection";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
beforeEach(() => {
  mocks.canManage = false;
  mocks.listBalances.mockResolvedValue([]);
  mocks.apiFetch.mockImplementation(async (path: string) => path === "/inventory/transfers/warehouses"
    ? { data: [{ _id: "w1", branchId: "hn", name: "Kho Hà Nội" }, { _id: "w2", branchId: "hcm", name: "Kho Hồ Chí Minh" }] }
    : { data: [{ _id: "t1", code: "DC-01", status: "in_transit", fromBranchId: "hn", fromWarehouseId: "w1", toBranchId: "hcm", toWarehouseId: "w2", items: [{ sku: "PHONE-01", quantity: 1 }], reason: "Bổ sung tồn", createdAt: "2026-10-24" }] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("inventory transfer surface", () => {
  it("shows transfer documents to a reader without mutation actions", async () => {
    render(<InventoryTransfersSection />);
    expect(await screen.findByText("DC-01")).toBeTruthy();
    expect(screen.getByText(/PHONE-01/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo phiếu điều chuyển" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hủy phiếu" })).toBeNull();
  });

  it("opens the transfer form in a popup for a manager", async () => {
    mocks.canManage = true;
    render(<InventoryTransfersSection />);
    await screen.findByText("DC-01");
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo phiếu điều chuyển" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Kho gửi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng phiếu điều chuyển" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tạo phiếu điều chuyển" })).toBeNull());
  });

  it("shows serial or unit-code fields only for the selected tracking mode", async () => {
    mocks.canManage = true;
    mocks.listBalances.mockResolvedValue([
      { _id: "b1", variantId: "bulk", sku: "BULK", quantity: 5, reservedQuantity: 0, trackingMode: "quantity" },
      { _id: "b2", variantId: "serial", sku: "DEVICE", quantity: 5, reservedQuantity: 0, trackingMode: "serial" },
      { _id: "b3", variantId: "unit", sku: "SUPPLY", quantity: 5, reservedQuantity: 0, trackingMode: "unit_barcode" },
    ]);
    render(<InventoryTransfersSection />);
    await screen.findByText("DC-01");
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    await screen.findByRole("option", { name: /BULK/ });
    const sku = screen.getByRole("combobox", { name: "SKU" });
    fireEvent.change(sku, { target: { value: "bulk" } });
    expect(screen.queryByRole("textbox", { name: /sê-ri|đơn vị/i })).toBeNull();
    fireEvent.change(sku, { target: { value: "serial" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Số sê-ri của hàng chuyển" }), { target: { value: "SER-1" } });
    fireEvent.change(sku, { target: { value: "unit" } });
    expect((screen.getByRole("textbox", { name: "Mã đơn vị của hàng chuyển" }) as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(sku, { target: { value: "bulk" } });
    expect(screen.queryByRole("textbox", { name: /sê-ri|đơn vị/i })).toBeNull();
  });
  it("clears selected lines and conflicting destination when the source warehouse changes", async () => {
    mocks.canManage = true;
    mocks.apiFetch.mockImplementation(async (path: string) => ({ data: path.endsWith('/warehouses') ? [{ _id: "w1", branchId: "hn", name: "Kho Hà Nội" }, { _id: "w3", branchId: "hn", name: "Kho vật tư" }] : [] }));
    mocks.listBalances.mockResolvedValue([{ _id: "b1", variantId: "bulk", sku: "BULK", quantity: 5, reservedQuantity: 0, trackingMode: "quantity" }]);
    render(<InventoryTransfersSection />);
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w1'));
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    await screen.findByRole("option", { name: /BULK/ });
    fireEvent.change(screen.getByRole("combobox", { name: "SKU" }), { target: { value: "bulk" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Kho nhận" }), { target: { value: "w3" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Kho gửi" }), { target: { value: "w3" } });
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w3'));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "SKU" }) as HTMLSelectElement).value).toBe(''));
    expect((screen.getByRole("combobox", { name: "Kho nhận" }) as HTMLSelectElement).value).toBe('');
  });

  it("closes confirmation on a failed cancellation so the error remains visible", async () => {
    mocks.canManage = true;
    render(<InventoryTransfersSection />);
    await screen.findByText('DC-01');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do hủy phiếu' }), { target: { value: 'Sai kho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(screen.getByRole('dialog', { name: 'Hủy phiếu điều chuyển' })).toBeTruthy();
    mocks.apiFetch.mockRejectedValueOnce(new Error('Phiếu đã được kho nhận xử lý.'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('dialog', { name: 'Hủy phiếu điều chuyển' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Phiếu đã được kho nhận xử lý.');
  });
});
