// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "admin-1" }, userProfile: { role: "admin" } }),
}));

vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: "branch-a", loading: false }),
}));

vi.mock("../hooks/useSubTabRouter", () => ({
  useSubTabRouter: () => ["SẢN PHẨM", vi.fn()],
}));

vi.mock("../services/inventoryCategoryService", () => ({
  inventoryCategoryService: { subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock("../services/inventoryProductService", () => ({
  inventoryProductService: { subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock("../services/inventoryStockLogService", () => ({
  inventoryStockLogService: { subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock("../services/productCatalogService", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    productCatalogService: {
      ...(actual.productCatalogService as Record<string, unknown>),
      listProducts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      listResources: vi.fn().mockResolvedValue([]),
    },
    subscribeResourceChanges: vi.fn(() => vi.fn()),
  };
});

import InventoryTab from "./InventoryTab";

describe("InventoryTab navigation standardization", () => {
  it("renders the standardized ModuleNavigation bar with all subtabs and icons", () => {
    render(<InventoryTab />);

    const nav = screen.getByRole("navigation", { name: "Mục Kho & Sản phẩm" });
    expect(nav).toBeDefined();

    const expectedTabs = [
      "Sản phẩm",
      "Kho hàng",
      "Nhập hàng",
      "IMEI / Serial",
      "Xuất hàng",
      "Điều chuyển",
      "Giao dịch kho",
      "Dự báo",
    ];

    expectedTabs.forEach((tabLabel) => {
      const button = screen.getByRole("button", { name: tabLabel });
      expect(button).toBeDefined();
    });

    // Check active tab has aria-current="page"
    const activeTabButton = screen.getByRole("button", { name: "Sản phẩm" });
    expect(activeTabButton.getAttribute("aria-current")).toBe("page");
  });
});

