// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCatalogV2Section } from "./ProductCatalogV2Section";
import { productCatalogService } from "../../services/productCatalogService";

vi.mock("../../services/productCatalogService", () => {
  const productCatalogService = {
    listProducts: vi.fn(), listResources: vi.fn(), getProduct: vi.fn(), listPrices: vi.fn(), createVariants: vi.fn(), createVariant: vi.fn(), updateVariant: vi.fn(), upsertPrice: vi.fn(), deleteProduct: vi.fn(),
  };
  return { productCatalogService, subscribeResourceChanges: vi.fn(() => () => {}) };
});

const product = {
  _id: "product-1", productCode: "AO-01", name: "Áo thun", productType: "physical" as const,
  categoryCode: "AO", baseUnitCode: "PCS", status: "active" as const, mediaIds: [], documentIds: [], variants: [{
    _id: "variant-1", sku: "AO-DEN", barcode: "", displayName: "", unitCode: "PCS", trackingMode: "quantity" as const,
    status: "active" as const, mediaIds: [], optionValues: [], supplierWarrantyMonths: 0,
  }],
};

describe("ProductCatalogV2Section bulk SKU form", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productCatalogService.listProducts).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 10 });
    vi.mocked(productCatalogService.listResources).mockResolvedValue([]);
    vi.mocked(productCatalogService.getProduct).mockResolvedValue(product);
    vi.mocked(productCatalogService.listPrices).mockResolvedValue([]);
    vi.mocked(productCatalogService.createVariants).mockResolvedValue([]);
    vi.mocked(productCatalogService.createVariant).mockResolvedValue(product.variants[0]);
    vi.mocked(productCatalogService.updateVariant).mockResolvedValue(product.variants[0]);
    vi.mocked(productCatalogService.upsertPrice).mockResolvedValue({});
  });

  it("opens with one standard SKU form and submits newly added SKU", async () => {
    const { container } = render(<ProductCatalogV2Section />);
    await screen.findByText("Áo thun");
    fireEvent.click(container.querySelector('button[title="Sửa sản phẩm"]')!);
    fireEvent.click(await screen.findByText("Biến thể (1)"));
    await screen.findByText("Thêm một SKU");
    fireEvent.click(screen.getByText("Thêm một SKU"));

    await waitFor(() => expect(screen.getAllByLabelText("Mã SKU")).toHaveLength(1));
    const skuInputs = screen.getAllByLabelText("Mã SKU");
    fireEvent.change(skuInputs[0], { target: { value: "AO-MOI" } });
    fireEvent.click(screen.getByText("Thêm mã SKU"));

    await waitFor(() => expect(productCatalogService.createVariant).toHaveBeenCalledWith("product-1", expect.objectContaining({ sku: "AO-MOI" })));
  });

  it("keeps the product editor open beneath the SKU editor", async () => {
    const { container } = render(<ProductCatalogV2Section />);
    await waitFor(() => expect(productCatalogService.listProducts).toHaveBeenCalled());
    const editProductButton = Array.from(container.querySelectorAll("button")).find((button) => button.title.includes("sản phẩm"));
    fireEvent.click(editProductButton!);
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    fireEvent.click(screen.getByText("Biến thể (1)"));

    const editSkuButton = Array.from(container.querySelectorAll("button")).find((button) => button.title.includes("SKU"));
    fireEvent.click(editSkuButton!);
    await waitFor(() => expect(screen.getAllByRole("dialog").filter((dialog) => dialog.parentElement?.className.includes("z-[60]"))).toHaveLength(1));

    const skuDialog = screen.getAllByRole("dialog").find((dialog) => dialog.parentElement?.className.includes("z-[60]"))!;
    expect(screen.getAllByRole("dialog").some((dialog) => !dialog.parentElement?.className.includes("z-[60]"))).toBe(true);
    fireEvent.click(skuDialog.querySelector("button")!);
    await waitFor(() => expect(screen.getAllByRole("dialog").some((dialog) => !dialog.parentElement?.className.includes("z-[60]"))).toBe(true));
  });

  it.each(["draft", "active", "inactive", "archived"] as const)("allows SKU editing when the product is %s", async (status) => {
    const productWithStatus = { ...product, status };
    vi.mocked(productCatalogService.listProducts).mockResolvedValue({ items: [productWithStatus], total: 1, page: 1, limit: 10 });
    vi.mocked(productCatalogService.getProduct).mockResolvedValue(productWithStatus);
    const { container } = render(<ProductCatalogV2Section />);

    const editProductButton = await waitFor(() => {
      expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
      const button = Array.from(container.querySelectorAll("button")).find((item) => item.title.includes("sản phẩm"));
      expect(button).toBeDefined();
      return button!;
    });
    fireEvent.click(editProductButton);
    await waitFor(() => expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1));
    fireEvent.click(screen.getByText("Biến thể (1)"));
    const editSkuButton = Array.from(container.querySelectorAll("button")).find((button) => button.title.includes("SKU"));
    fireEvent.click(editSkuButton!);

    const skuInput = within(container).getByLabelText("Mã SKU");
    expect((skuInput as HTMLInputElement).readOnly).toBe(false);
    fireEvent.change(skuInput, { target: { value: "ao-moi" } });
    fireEvent.click(within(container).getAllByText("Lưu thay đổi").at(-1)!);

    await waitFor(() => expect(productCatalogService.updateVariant).toHaveBeenCalledWith("variant-1", expect.objectContaining({ sku: "ao-moi" })));
    if (status === "active") {
      expect(productCatalogService.upsertPrice).toHaveBeenCalledWith("variant-1", 0);
    } else {
      expect(productCatalogService.upsertPrice).not.toHaveBeenCalled();
    }
  });

  it("shows confirmation popup when clicking delete product, and cancels when dismissed", async () => {
    const { container } = render(<ProductCatalogV2Section />);
    await screen.findByText("Áo thun");

    const deleteBtn = container.querySelector('button[title="Xóa"]')!;
    expect(deleteBtn).toBeDefined();
    fireEvent.click(deleteBtn);

    // ConfirmDialog opens
    expect(await screen.findByText("Xác nhận xóa sản phẩm")).not.toBeNull();
    expect(screen.getByText(/Bạn có chắc chắn muốn xóa sản phẩm "Áo thun"/)).not.toBeNull();

    // Click "Hủy"
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByText("Xác nhận xóa sản phẩm")).toBeNull());
    expect(productCatalogService.deleteProduct).not.toHaveBeenCalled();
  });

  it("deletes the product when confirmed in the popup", async () => {
    vi.mocked(productCatalogService.deleteProduct).mockResolvedValue();
    const { container } = render(<ProductCatalogV2Section />);
    await screen.findByText("Áo thun");

    const deleteBtn = container.querySelector('button[title="Xóa"]')!;
    fireEvent.click(deleteBtn);

    expect(await screen.findByText("Xác nhận xóa sản phẩm")).not.toBeNull();

    // Click "Xóa sản phẩm"
    fireEvent.click(screen.getByRole("button", { name: "Xóa sản phẩm" }));

    await waitFor(() => expect(productCatalogService.deleteProduct).toHaveBeenCalledWith("product-1"));
  });

  it("shows zero stock on goods, zero price on services, and filters service rows on the server", async () => {
    const service = { ...product, _id: "service-1", productCode: "DV-1", name: "Lắp đặt",
      productType: "service" as const, branchSummary: { sellingPriceMin: 0, sellingPriceMax: 0, availableStock: null } };
    const goods = { ...product, branchSummary: { sellingPriceMin: null, sellingPriceMax: null, availableStock: 0 } };
    vi.mocked(productCatalogService.listProducts).mockImplementation(async ({ catalogKind } = {}) => ({
      items: catalogKind === "services" ? [service] : [goods, service], total: catalogKind === "services" ? 1 : 2, page: 1, limit: 10,
    }));
    render(<ProductCatalogV2Section workspace={{ mode: "mixed", configured: true, hasSerial: false }} branchId="branch-a" />);

    const table = await screen.findByRole("table");
    const goodsRow = within(table).getByRole("row", { name: /Áo thun/ });
    const serviceRow = within(table).getByRole("row", { name: /Lắp đặt/ });
    expect(within(goodsRow).getByText("0")).toBeTruthy();
    expect(within(serviceRow).getByText("0 ₫")).toBeTruthy();
    expect(within(serviceRow).getByTitle("Dịch vụ không theo dõi tồn")).toBeTruthy();

    fireEvent.click(within(screen.getByRole("group", { name: "Loại danh mục" })).getByRole("button", { name: "Dịch vụ" }));
    await waitFor(() => expect(productCatalogService.listProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ catalogKind: "services", branchId: "branch-a", page: 1 }), expect.anything(),
    ));
    expect(await screen.findByRole("columnheader", { name: "Cơ sở cung cấp" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Tồn khả dụng" })).toBeNull();
    expect(screen.queryByText("Áo thun")).toBeNull();
  });

  it("discards list results arriving after switching between goods and services", async () => {
    type CatalogResult = Awaited<ReturnType<typeof productCatalogService.listProducts>>;
    let finishGoods!: (value: CatalogResult) => void;
    let finishServices!: (value: CatalogResult) => void;
    const goodsRequest = new Promise<CatalogResult>(resolve => { finishGoods = resolve; });
    const serviceRequest = new Promise<CatalogResult>(resolve => { finishServices = resolve; });
    const service = { ...product, _id: "service-1", name: "Lắp đặt", productType: "service" as const };
    vi.mocked(productCatalogService.listProducts)
      .mockReturnValueOnce(goodsRequest)
      .mockReturnValueOnce(serviceRequest)
      .mockResolvedValueOnce({ items: [product, service], total: 2, page: 1, limit: 10 });
    const { rerender } = render(<ProductCatalogV2Section workspace={{ mode: "goods", configured: true, hasSerial: false }} />);
    rerender(<ProductCatalogV2Section workspace={{ mode: "services", configured: true, hasSerial: false }} />);
    rerender(<ProductCatalogV2Section workspace={{ mode: "mixed", configured: true, hasSerial: false }} />);
    await screen.findByText("Lắp đặt");
    await act(async () => {
      finishGoods({ items: [product], total: 1, page: 1, limit: 10 });
      finishServices({ items: [service], total: 1, page: 1, limit: 10 });
    });
    expect(screen.getByText("Áo thun")).toBeTruthy();
    expect(screen.getByText("Lắp đặt")).toBeTruthy();
    expect(vi.mocked(productCatalogService.listProducts).mock.calls[0]?.[1]?.aborted).toBe(true);
    expect(vi.mocked(productCatalogService.listProducts).mock.calls[1]?.[1]?.aborted).toBe(true);
  });
});
