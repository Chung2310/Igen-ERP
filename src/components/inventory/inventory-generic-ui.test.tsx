// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WarehouseSection } from "./WarehouseSection";
import { InventoryCountingModal } from "./InventoryCountingSection";
import { ReceivingSection } from "./ReceivingSection";
import { inventoryCountService } from "../../services/inventoryCountService";
import { inventorySerialService } from "../../services/inventorySerialService";

vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: {
  listWarehouses: vi.fn(async () => [{ _id: "w1", name: "Kho chính", isDefault: true }]),
  listBalances: vi.fn(async () => [
    { _id: "b1", warehouseId: "w1", productId: "p1", productName: "Giấy A4", sku: "PAPER", trackingMode: "quantity", quantity: 20, reservedQuantity: 0, averageCost: 10 },
    { _id: "b2", warehouseId: "w1", productId: "p2", productName: "Thiết bị A", sku: "DEVICE", trackingMode: "serial", quantity: 1, reservedQuantity: 0, averageCost: 20 },
    { _id: "b3", warehouseId: "w1", productId: "p3", productName: "Vật tư B", sku: "SUPPLY", trackingMode: "unit_barcode", quantity: 1, reservedQuantity: 0, averageCost: 30 },
  ]),
  listReceipts: vi.fn(async () => ({ items: [], total: 0 })), listSuppliers: vi.fn(async () => []),
} }));
vi.mock("../../services/productCatalogService", () => ({ productCatalogService: { listProducts: vi.fn(async () => ({ items: [], total: 0 })) } }));
vi.mock("../../services/inventoryCountService", () => ({ inventoryCountService: { list: vi.fn(async () => []), create: vi.fn(), syncPending: vi.fn(async () => []) } }));
vi.mock("../../services/inventorySerialService", () => ({ inventorySerialService: { list: vi.fn(async () => ({ items: [{ _id: "unit-1", internalBarcode: "UNIT-1", serialNumber: "SER-1" }], total: 1 })) } }));
vi.mock("./StockAlertPanel", () => ({ StockAlertPanel: () => null }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

const count = (trackingMode: "quantity" | "serial") => ({ _id: "count-1", countCode: "KK-1", warehouseId: "w1", status: "draft", items: [
  { _id: "line-1", productId: "p1", sku: "PAPER", productName: "Giấy A4", trackingMode, systemQuantity: 10, countedQuantity: 10, quantityDelta: 0 },
] });

describe("shared inventory surfaces", () => {
  it("offers unit details only for SKUs configured to track individual units", async () => {
    render(<WarehouseSection />);
    for (const name of ["Giấy A4", "Thiết bị A", "Vật tư B"]) fireEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
    expect(screen.getAllByRole("button", { name: "Xem số sê-ri" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Xem mã đơn vị" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /IMEI/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Xem mã đơn vị" }));
    expect(await screen.findByRole("dialog", { name: "Chi tiết đơn vị hàng" })).toBeTruthy();
    expect(await screen.findByText("UNIT-1")).toBeTruthy();
    expect(inventorySerialService.list).toHaveBeenCalledWith(expect.objectContaining({ trackingMode: "unit_barcode" }));
    expect(screen.queryByRole("columnheader", { name: "Số sê-ri" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Bảo hành/ })).toBeNull();
  });

  it.each(["quantity", "serial"] as const)("uses manual counting for ordinary stock and scanning only for tracked units (%s)", async (mode) => {
    vi.mocked(inventoryCountService.create).mockResolvedValue(count(mode) as any);
    render(<InventoryCountingModal warehouseId="w1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu" }));
    const input = await screen.findByRole("spinbutton", { name: "Số lượng đếm PAPER" }) as HTMLInputElement;
    expect(input.disabled).toBe(mode === "serial");
    expect(Boolean(screen.queryByRole("textbox", { name: "Mã vạch kiểm kê" }))).toBe(mode === "serial");
    expect(Boolean(screen.queryByRole("columnheader", { name: "Quản lý theo" }))).toBe(mode === "serial");
  });

  it("starts a generic receipt without unit or warranty columns and lets the user opt into warranty", async () => {
    render(<ReceivingSection />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo phiếu nhập mới" }));
    await waitFor(() => expect(screen.getByText("Danh sách nhập (0 dòng)")).toBeTruthy());
    expect(screen.queryByRole("columnheader", { name: "Mã đơn vị" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /Bảo hành/ })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Thông tin bảo hành" }));
    expect(screen.getByRole("columnheader", { name: "Bảo hành (tháng)" })).toBeTruthy();
  });
});
