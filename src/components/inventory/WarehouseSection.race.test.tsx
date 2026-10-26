// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WarehouseSection } from "./WarehouseSection";
import { inventoryReceivingService, type InventoryBalance } from "../../services/inventoryReceivingService";

vi.mock("../../services/inventoryReceivingService", () => ({ inventoryReceivingService: { listWarehouses: vi.fn(), listBalances: vi.fn() } }));
vi.mock("./StockAlertPanel", () => ({ StockAlertPanel: () => null }));
vi.mock("./InventoryCountingSection", () => ({ InventoryCountingModal: () => null }));
vi.mock("./WarehouseSerialDetailModal", () => ({ WarehouseSerialDetailModal: () => null }));
vi.mock("../../pages/Toast", () => ({ toast: { error: vi.fn() } }));
afterEach(cleanup);

it("keeps the selected warehouse balances when an earlier warehouse request finishes late", async () => {
  let resolveA!: (items: InventoryBalance[]) => void;
  let resolveB!: (items: InventoryBalance[]) => void;
  const responseA = new Promise<InventoryBalance[]>((resolve) => { resolveA = resolve; });
  const responseB = new Promise<InventoryBalance[]>((resolve) => { resolveB = resolve; });
  vi.mocked(inventoryReceivingService.listWarehouses).mockResolvedValue([
    { _id: "a", name: "Kho A", isDefault: true, isActive: true } as any,
    { _id: "b", name: "Kho B", isDefault: false, isActive: true } as any,
  ]);
  vi.mocked(inventoryReceivingService.listBalances).mockImplementation((id) => id === "a" ? responseA : responseB);
  render(<WarehouseSection />);
  await waitFor(() => expect(inventoryReceivingService.listBalances).toHaveBeenCalledWith("a"));
  fireEvent.click(screen.getByRole("button", { name: "Chọn kho hàng" }));
  fireEvent.click(screen.getByRole("option", { name: "Kho B" }));
  await waitFor(() => expect(inventoryReceivingService.listBalances).toHaveBeenCalledWith("b"));
  const row = (warehouseId: string): InventoryBalance => ({ _id: warehouseId, warehouseId, productId: warehouseId, sku: warehouseId,
    productName: `Hàng của kho ${warehouseId.toUpperCase()}`, quantity: 5, reservedQuantity: 0, averageCost: 10 });
  await act(async () => { resolveB([row("b")]); });
  await act(async () => { resolveA([row("a")]); });
  expect(await screen.findByRole("button", { name: /Hàng của kho B/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Hàng của kho A/ })).toBeNull();
});
