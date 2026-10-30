// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), listBalances: vi.fn(), canManage: false }));
vi.mock("../../modules/shared/lib/apiFetch", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: { listBalances: mocks.listBalances } }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "user", companyCode: "QA_EDU" }, hasPermission: (code: string) => code === "inventory:manage" && mocks.canManage }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "hn", branches: [{ _id: "hn", name: "Hà Nội" }] }) }));
import { InventoryTransfersSection } from "./InventoryTransfersSection";

function choose(name: string, option: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
beforeEach(() => {
  mocks.canManage = false;
  mocks.listBalances.mockResolvedValue([]);
  mocks.apiFetch.mockImplementation(async (path: string) => path === "/inventory/transfers/branches"
    ? { data: [{ _id: "hn", code: "HN", name: "Hà Nội" }, { _id: "hcm", code: "HCM", name: "Hồ Chí Minh" }] }
    : path === "/inventory/transfers/warehouses"
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
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w1'));
    choose("SKU", /BULK/);
    expect(screen.queryByRole("textbox", { name: /sê-ri|đơn vị/i })).toBeNull();
    choose("SKU", /DEVICE/);
    fireEvent.change(screen.getByRole("textbox", { name: "Số sê-ri của hàng chuyển" }), { target: { value: "SER-1" } });
    choose("SKU", /SUPPLY/);
    expect((screen.getByRole("textbox", { name: "Mã đơn vị của hàng chuyển" }) as HTMLTextAreaElement).value).toBe("");
    choose("SKU", /BULK/);
    expect(screen.queryByRole("textbox", { name: /sê-ri|đơn vị/i })).toBeNull();
  });
  it("clears selected lines and conflicting destination when the source warehouse changes", async () => {
    mocks.canManage = true;
    mocks.apiFetch.mockImplementation(async (path: string) => ({ data: path.endsWith('/branches') ? [{ _id: "hn", code: "HN", name: "Hà Nội" }] : path.endsWith('/warehouses') ? [{ _id: "w1", branchId: "hn", name: "Kho Hà Nội" }, { _id: "w3", branchId: "hn", name: "Kho vật tư" }] : [] }));
    mocks.listBalances.mockResolvedValue([{ _id: "b1", variantId: "bulk", sku: "BULK", quantity: 5, reservedQuantity: 0, trackingMode: "quantity" }]);
    render(<InventoryTransfersSection />);
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w1'));
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    choose("SKU", /BULK/);
    choose("Chi nhánh nhận", "Hà Nội (nội bộ)");
    choose("Kho nhận", "Kho vật tư");
    choose("Kho gửi", "Kho vật tư");
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w3'));
    await waitFor(() => expect(screen.getByRole("button", { name: "SKU" }).textContent).toContain('Chọn SKU còn hàng'));
    expect(screen.getByRole("button", { name: "Kho nhận" }).textContent).toContain('Chọn kho nhận');
  });

  it("transfers to an existing branch without requiring a pre-created receiving warehouse", async () => {
    mocks.canManage = true;
    mocks.listBalances.mockResolvedValue([{ _id: "b1", variantId: "bulk", sku: "BULK", quantity: 5, reservedQuantity: 0, trackingMode: "quantity" }]);
    mocks.apiFetch.mockImplementation(async (path: string) => ({ data: path.endsWith('/branches')
      ? [{ _id: "hn", code: "HN", name: "Hà Nội" }, { _id: "hcm", code: "HCM", name: "Hồ Chí Minh" }]
      : path.endsWith('/warehouses') ? [{ _id: "w1", branchId: "hn", name: "Kho Hà Nội" }] : [] }));
    render(<InventoryTransfersSection />);
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w1'));
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu điều chuyển" }));
    choose("Chi nhánh nhận", "Hồ Chí Minh");
    expect(screen.getByText(/Chi nhánh chưa có kho/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kho nhận" }).textContent).toContain('Kho mặc định của chi nhánh');
    choose('SKU', /BULK/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Lý do điều chuyển' }), { target: { value: 'Bổ sung chi nhánh' } });
    const balanceLoads = mocks.listBalances.mock.calls.length;
    fireEvent.submit(screen.getByRole('dialog', { name: 'Tạo phiếu điều chuyển' }).querySelector('form')!);
    await screen.findByText('Đã tạo phiếu điều chuyển. Kho nhận cần xác nhận.');
    const request = mocks.apiFetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(request).toBeTruthy();
    const payload = JSON.parse(request![1].body);
    expect(payload.toBranchId).toBe('hcm');
    expect(payload).not.toHaveProperty('toWarehouseId');
    await waitFor(() => expect(mocks.listBalances.mock.calls.length).toBeGreaterThan(balanceLoads));
  });

  it("clears a warehouse from the previous receiving branch", async () => {
    mocks.canManage = true;
    mocks.apiFetch.mockImplementation(async (path: string) => ({ data: path.endsWith('/branches')
      ? [{ _id: 'hn', name: 'Hà Nội' }, { _id: 'hcm', name: 'Hồ Chí Minh' }, { _id: 'dn', name: 'Đà Nẵng' }]
      : path.endsWith('/warehouses') ? [{ _id: 'w1', branchId: 'hn', name: 'Kho Hà Nội' }, { _id: 'w2', branchId: 'hcm', name: 'Kho Hồ Chí Minh' }] : [] }));
    render(<InventoryTransfersSection />);
    await waitFor(() => expect(mocks.listBalances).toHaveBeenCalledWith('w1'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu điều chuyển' }));
    choose('Chi nhánh nhận', 'Hồ Chí Minh');
    choose('Kho nhận', 'Kho Hồ Chí Minh');
    choose('Chi nhánh nhận', 'Đà Nẵng');
    expect(screen.getByRole('button', { name: 'Kho nhận' }).textContent).toContain('Kho mặc định của chi nhánh');
    expect(screen.queryByRole('option', { name: 'Kho Hồ Chí Minh' })).toBeNull();
  });

  it("searches and filters documents without hiding a way back to the full list", async () => {
    render(<InventoryTransfersSection />);
    await screen.findByText('DC-01');
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm phiếu điều chuyển' }), { target: { value: 'không tồn tại' } });
    expect(screen.queryByText('DC-01')).toBeNull();
    expect(screen.getByText('Không tìm thấy phiếu phù hợp')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByText('DC-01')).toBeTruthy();
    choose('Lọc trạng thái điều chuyển', 'Đã nhận');
    expect(screen.queryByText('DC-01')).toBeNull();
    choose('Lọc trạng thái điều chuyển', 'Tất cả trạng thái');
    expect(screen.getByText('DC-01')).toBeTruthy();
  });

  it("shows field errors inside the popup when the SKU has not been selected", async () => {
    mocks.canManage = true;
    render(<InventoryTransfersSection />);
    await screen.findByText('DC-01');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiếu điều chuyển' }));
    choose('Chi nhánh nhận', 'Hồ Chí Minh');
    fireEvent.submit(screen.getByRole('dialog', { name: 'Tạo phiếu điều chuyển' }).querySelector('form')!);
    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('chọn SKU còn hàng');
    expect(screen.getByRole('dialog').contains(error)).toBe(true);
    expect(mocks.apiFetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
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
