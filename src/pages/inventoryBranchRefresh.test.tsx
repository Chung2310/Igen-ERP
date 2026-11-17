// @vitest-environment jsdom

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeBranchId: "branch-a",
  user: { uid: "admin-1" },
  userProfile: { role: "admin" },
  subscribeCategories: vi.fn(() => vi.fn()),
  subscribeProducts: vi.fn(() => vi.fn()),
  subscribeStockLogs: vi.fn(() => vi.fn()),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, userProfile: mocks.userProfile }),
}));

vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: mocks.activeBranchId, loading: false }),
}));

vi.mock("../hooks/useSubTabRouter", () => ({
  useSubTabRouter: () => ["DANH MỤC", vi.fn()],
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

vi.mock("../services/productCatalogService", () => ({
  productCatalogService: { getWorkspace: vi.fn().mockResolvedValue({ mode: "products", hasSerial: true }) },
}));

import InventoryTab from "./InventoryTab";

describe("InventoryTab branch refresh", () => {
  beforeEach(() => {
    mocks.activeBranchId = "branch-a";
    vi.clearAllMocks();
  });

  it("refreshes branch-scoped inventory data while keeping category requests company-wide", async () => {
    const view = render(<InventoryTab />);

    await waitFor(() => {
      expect(mocks.subscribeCategories).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
      expect(mocks.subscribeProducts).toHaveBeenCalledWith("branch-a", expect.any(Function), expect.any(Function));
      expect(mocks.subscribeStockLogs).toHaveBeenCalledWith("branch-a", expect.any(Function), expect.any(Function));
    });
    expect(mocks.subscribeCategories.mock.calls[0]).toHaveLength(2);

    mocks.activeBranchId = "branch-b";
    view.rerender(<InventoryTab />);

    await waitFor(() => {
      expect(mocks.subscribeProducts).toHaveBeenLastCalledWith("branch-b", expect.any(Function), expect.any(Function));
      expect(mocks.subscribeStockLogs).toHaveBeenLastCalledWith("branch-b", expect.any(Function), expect.any(Function));
    });
    expect(mocks.subscribeCategories.mock.calls.at(-1)).toHaveLength(2);
  });
});
