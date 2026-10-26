// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import InventoryTab from "./InventoryTab";

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

  it("keeps the shared inventory navigation generic and redirects the old IMEI page", () => {
    mocks.subTab = "IMEI / SERIAL";
    render(<InventoryTab />);
    expect(mocks.setSubTab).toHaveBeenCalledWith("KHO HÀNG");
  });
});
