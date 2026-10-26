// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeBranchId: "branch-a",
  subTab: "DANH MỤC",
  setSubTab: vi.fn(),
  subscribeCategories: vi.fn(() => vi.fn()),
  subscribeProducts: vi.fn(() => vi.fn()),
  subscribeStockLogs: vi.fn(() => vi.fn()),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "admin-1" }, userProfile: { role: "admin" } }),
}));

vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: mocks.activeBranchId, loading: false }),
}));

vi.mock("../hooks/useSubTabRouter", () => ({
  useSubTabRouter: () => [mocks.subTab, mocks.setSubTab],
}));

vi.mock("../services/inventoryCategoryService", () => ({
  inventoryCategoryService: { subscribe: mocks.subscribeCategories },
}));

vi.mock("../services/inventoryProductService", () => ({
  inventoryProductService: { subscribe: mocks.subscribeProducts },
}));

vi.mock("../services/inventoryStockLogService", () => ({
  inventoryStockLogService: { subscribe: mocks.subscribeStockLogs },
}));

vi.mock("../components/inventory/WarehouseSection", () => ({ WarehouseSection: () => <input aria-label="Đang soạn" defaultValue="" /> }));
vi.mock("../components/inventory/ReceivingSection", () => ({ ReceivingSection: () => <input aria-label="Đang soạn" defaultValue="" /> }));
vi.mock("../components/inventory/InventoryTransfersSection", () => ({ InventoryTransfersSection: () => <input aria-label="Đang soạn" defaultValue="" /> }));
vi.mock("../components/inventory/StockLogPanel", () => ({ StockLogPanel: () => <input aria-label="Đang soạn" defaultValue="" /> }));

import InventoryTab from "./InventoryTab";
afterEach(cleanup);
beforeAll(() => { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() }); });

describe("InventoryTab branch refresh", () => {
  beforeEach(() => {
    mocks.activeBranchId = "branch-a";
    mocks.subTab = "DANH MỤC";
    vi.clearAllMocks();
  });

  it("replaces inventory subscriptions immediately when the active branch changes", () => {
    const view = render(<InventoryTab />);

    expect(mocks.subscribeCategories).toHaveBeenCalledWith("branch-a", expect.any(Function), expect.any(Function));
    expect(mocks.subscribeProducts).toHaveBeenCalledWith("branch-a", expect.any(Function), expect.any(Function));
    expect(mocks.subscribeStockLogs).toHaveBeenCalledWith("branch-a", expect.any(Function), expect.any(Function));

    mocks.activeBranchId = "branch-b";
    view.rerender(<InventoryTab />);

    expect(mocks.subscribeCategories).toHaveBeenLastCalledWith("branch-b", expect.any(Function), expect.any(Function));
    expect(mocks.subscribeProducts).toHaveBeenLastCalledWith("branch-b", expect.any(Function), expect.any(Function));
    expect(mocks.subscribeStockLogs).toHaveBeenLastCalledWith("branch-b", expect.any(Function), expect.any(Function));
  });

  it.each(["KHO HÀNG", "NHẬP HÀNG", "ĐIỀU CHUYỂN", "XUẤT HÀNG", "GIAO DỊCH KHO"])("resets branch-specific warehouse/forms when switching branch (%s)", async (tab) => {
    mocks.subTab = tab;
    const view = render(<InventoryTab />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Đang soạn" }), { target: { value: "old branch warehouse/draft" } });
    mocks.activeBranchId = "branch-b";
    view.rerender(<InventoryTab />);
    expect((await screen.findByRole("textbox", { name: "Đang soạn" }) as HTMLInputElement).value).toBe("");
  });

  it("keeps the shared inventory navigation generic and redirects the old IMEI page", () => {
    mocks.subTab = "IMEI / SERIAL";
    render(<InventoryTab />);
    expect(mocks.setSubTab).toHaveBeenCalledWith("KHO HÀNG");
  });
});
