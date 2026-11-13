// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { productCatalogService } from "../services/productCatalogService";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "admin-1" }, userProfile: { role: "admin" }, hasPermission: () => true }),
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
      getWorkspace: vi.fn(),
      updateWorkspace: vi.fn(),
    },
    subscribeResourceChanges: vi.fn(() => vi.fn()),
  };
});

import InventoryTab from "./InventoryTab";

describe("InventoryTab navigation standardization", () => {
  afterEach(cleanup);

  it("shows warehouse operations and Serial for companies using them", async () => {
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValue({ mode: "goods", configured: true, hasSerial: true });
    render(<InventoryTab />);

    const nav = screen.getByRole("navigation", { name: "Mục Kho & Sản phẩm" });
    expect(nav).toBeDefined();

    const expectedTabs = [
      "Hàng hóa",
      "Kho hàng",
      "Nhập hàng",
      "IMEI / Serial",
      "Xuất hàng",
      "Điều chuyển",
      "Giao dịch kho",
      "Dự báo",
    ];

    for (const tabLabel of expectedTabs) {
      const button = await within(nav).findByRole("button", { name: tabLabel });
      expect(button).toBeDefined();
    }

    // Check active tab has aria-current="page"
    const activeTabButton = within(nav).getByRole("button", { name: "Hàng hóa" });
    expect(activeTabButton.getAttribute("aria-current")).toBe("page");
  });

  it("hides warehouse operations and stock columns in a service-only workspace", async () => {
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValue({ mode: "services", configured: true, hasSerial: true });
    render(<InventoryTab />);
    const nav = screen.getByRole("navigation", { name: "Mục Kho & Sản phẩm" });
    expect(await within(nav).findByRole("button", { name: "Dịch vụ" })).toBeTruthy();
    expect(within(nav).queryByRole("button", { name: "Nhập hàng" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "IMEI / Serial" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Thêm dịch vụ" })).toBeTruthy();
  });

  it("applies the saved workspace mode without changing routes", async () => {
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValue({ mode: "goods", configured: false, hasSerial: false });
    vi.mocked(productCatalogService.updateWorkspace).mockResolvedValue({ mode: "services", configured: true, hasSerial: false });
    render(<InventoryTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Thiết lập danh mục" }));
    const dialog = within(screen.getByRole("dialog", { name: "Thiết lập danh mục" }));
    const modes = within(dialog.getByRole("group", { name: "Chế độ hiển thị của doanh nghiệp" }));
    expect(modes.getAllByRole("radio")).toHaveLength(3);
    expect((modes.getByRole("radio", { name: "Chỉ bán hàng hóa" }) as HTMLInputElement).checked).toBe(true);
    expect(modes.getByRole("radio", { name: "Hàng hóa và dịch vụ" })).toBeTruthy();
    fireEvent.click(modes.getByRole("radio", { name: "Chỉ cung cấp dịch vụ" }));
    expect(productCatalogService.updateWorkspace).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Lưu chế độ" }));
    expect(await screen.findByRole("button", { name: "Thêm dịch vụ" })).toBeTruthy();
    expect(productCatalogService.updateWorkspace).toHaveBeenCalledWith("services");
  });
});

