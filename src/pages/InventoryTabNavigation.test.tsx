// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { productCatalogService } from "../services/productCatalogService";
import type { CatalogWorkspaceSettings } from "../../shared/inventory/catalog-workspace";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "admin-1" }, userProfile: { role: "admin" }, hasPermission: () => true }),
}));

vi.mock("../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: "branch-a", loading: false }),
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
      deleteProduct: vi.fn(),
    },
    subscribeResourceChanges: vi.fn(() => vi.fn()),
  };
});

import InventoryTab from "./InventoryTab";

describe("InventoryTab navigation standardization", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

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

  it("switches catalog mode repeatedly and restores stock navigation and filters", async () => {
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValue({ mode: "goods", configured: false, hasSerial: true });
    vi.mocked(productCatalogService.updateWorkspace).mockImplementation(async mode => ({ mode, configured: true, hasSerial: true }));
    render(<InventoryTab />);
    const nav = within(screen.getByRole("navigation", { name: "Mục Kho & Sản phẩm" }));
    const settings = [
      { mode: "services", option: "Chỉ cung cấp dịch vụ", create: "Thêm dịch vụ" },
      { mode: "mixed", option: "Hàng hóa và dịch vụ", create: "Thêm" },
      { mode: "goods", option: "Chỉ bán hàng hóa", create: "Thêm hàng hóa" },
    ] as const;
    for (const [index, choice] of [...settings, ...settings].entries()) {
      fireEvent.click(await screen.findByRole("button", { name: "Thiết lập danh mục" }));
      const dialog = within(screen.getByRole("dialog", { name: "Thiết lập danh mục" }));
      const modes = within(dialog.getByRole("group", { name: "Chế độ hiển thị của doanh nghiệp" }));
      expect(modes.getAllByRole("radio")).toHaveLength(3);
      fireEvent.click(modes.getByRole("radio", { name: choice.option }));
      expect(productCatalogService.updateWorkspace).toHaveBeenCalledTimes(index);
      fireEvent.click(dialog.getByRole("button", { name: "Lưu chế độ" }));
      expect(await screen.findByRole("button", { name: choice.create })).toBeTruthy();
      expect(productCatalogService.updateWorkspace).toHaveBeenLastCalledWith(choice.mode);
      expect(Boolean(nav.queryByRole("button", { name: "IMEI / Serial" }))).toBe(choice.mode !== "services");
      expect(new URLSearchParams(window.location.search).get("sub")).toBe("san-pham");
      await waitFor(() => expect(productCatalogService.listProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ catalogKind: choice.mode === "mixed" ? undefined : choice.mode, page: 1 }),
        expect.anything(),
      ));
    }
  }, 15_000);

  it("returns a hidden Serial deep link to the catalog", async () => {
    window.history.replaceState(null, "", "/kho-san-pham?sub=imei-serial");
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValue({ mode: "goods", configured: true, hasSerial: false });
    render(<InventoryTab />);
    expect(await screen.findByRole("button", { name: "Thêm hàng hóa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "IMEI / Serial" })).toBeNull();
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("sub")).toBe("san-pham"));
  });

  it("keeps the catalog usable and hides warehouse operations until settings recover", async () => {
    vi.mocked(productCatalogService.getWorkspace)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ mode: "services", configured: true, hasSerial: false });
    render(<InventoryTab />);
    expect(await screen.findByText("Chưa tải được thiết lập danh mục.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kho hàng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "IMEI / Serial" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("button", { name: "Thêm dịch vụ" })).toBeTruthy();
  });

  it("ignores a workspace refresh that resolves after a newer mode was saved", async () => {
    let resolveRefresh!: (settings: CatalogWorkspaceSettings) => void;
    const delayed = new Promise<CatalogWorkspaceSettings>(resolve => { resolveRefresh = resolve; });
    const goods = { mode: "goods", configured: true, hasSerial: false } as const;
    vi.mocked(productCatalogService.getWorkspace).mockResolvedValueOnce(goods).mockReturnValueOnce(delayed);
    vi.mocked(productCatalogService.updateWorkspace).mockResolvedValue({ ...goods, mode: "services" });
    vi.mocked(productCatalogService.deleteProduct).mockResolvedValue(undefined);
    vi.mocked(productCatalogService.listProducts).mockResolvedValueOnce({ items: [{
      _id: "goods-1", name: "Hàng mẫu", productCode: "SP-01", productType: "physical", status: "active",
      categoryCode: "GENERAL", baseUnitCode: "PCS", mediaIds: [], documentIds: [],
    }], total: 1, page: 1, limit: 10 });
    render(<InventoryTab />);
    // A catalog refresh can still be in flight when a settings write finishes.
    const row = await screen.findByRole("row", { name: /Hàng mẫu/ });
    fireEvent.click(within(row).getByRole("button", { name: "Xóa Hàng mẫu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa sản phẩm" }));
    await waitFor(() => expect(productCatalogService.getWorkspace).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập danh mục" }));
    const dialog = within(screen.getByRole("dialog", { name: "Thiết lập danh mục" }));
    fireEvent.click(dialog.getByRole("radio", { name: "Chỉ cung cấp dịch vụ" }));
    fireEvent.click(dialog.getByRole("button", { name: "Lưu chế độ" }));
    await screen.findByRole("button", { name: "Thêm dịch vụ" });
    await act(async () => resolveRefresh(goods));
    expect(screen.getByRole("button", { name: "Thêm dịch vụ" })).toBeTruthy();
  });
});

