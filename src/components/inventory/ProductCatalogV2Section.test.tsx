// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCatalogV2Section } from "./ProductCatalogV2Section";
import { productCatalogService } from "../../services/productCatalogService";

vi.mock("../../services/productCatalogService", () => {
  const productCatalogService = {
    listProducts: vi.fn(), listResources: vi.fn(), getProduct: vi.fn(), listPrices: vi.fn(), createVariants: vi.fn(),
  };
  return { productCatalogService };
});

const product = {
  _id: "product-1", productCode: "AO-01", name: "Áo thun", productType: "physical" as const,
  categoryCode: "AO", baseUnitCode: "PCS", status: "active" as const, mediaIds: [], documentIds: [], variants: [{
    _id: "variant-1", sku: "AO-DEN", barcode: "", displayName: "", unitCode: "PCS", trackingMode: "quantity" as const,
    status: "active" as const, mediaIds: [], optionValues: [], supplierWarrantyMonths: 0,
  }],
};

describe("ProductCatalogV2Section bulk SKU form", () => {
  beforeEach(() => {
    vi.mocked(productCatalogService.listProducts).mockResolvedValue({ items: [product], total: 1, page: 1, limit: 10 });
    vi.mocked(productCatalogService.listResources).mockResolvedValue([]);
    vi.mocked(productCatalogService.getProduct).mockResolvedValue(product);
    vi.mocked(productCatalogService.listPrices).mockResolvedValue([]);
    vi.mocked(productCatalogService.createVariants).mockResolvedValue([]);
  });

  it("opens with one standard SKU form and submits each added SKU in one bulk request", async () => {
    const { container } = render(<ProductCatalogV2Section />);
    await screen.findByText("Áo thun");
    fireEvent.click(container.querySelector('button[title="Sửa sản phẩm"]')!);
    await screen.findByText("Tạo nhanh nhiều SKU");
    fireEvent.click(screen.getByText("Tạo nhanh nhiều SKU"));

    await waitFor(() => expect(screen.getAllByLabelText("Mã SKU")).toHaveLength(1));
    fireEvent.click(screen.getByText("Thêm SKU"));
    await waitFor(() => expect(screen.getAllByLabelText("Mã SKU")).toHaveLength(2));
    const skuInputs = screen.getAllByLabelText("Mã SKU");
    fireEvent.change(skuInputs[0], { target: { value: "AO-DEN" } });
    fireEvent.change(skuInputs[1], { target: { value: "AO-TRANG" } });
    fireEvent.click(screen.getByText("Tạo các SKU"));

    await waitFor(() => expect(productCatalogService.createVariants).toHaveBeenCalledWith("product-1", expect.arrayContaining([
      expect.objectContaining({ sku: "AO-DEN" }),
      expect.objectContaining({ sku: "AO-TRANG" }),
    ])));
  });

  it("keeps the product editor open beneath the SKU editor", async () => {
    const { container } = render(<ProductCatalogV2Section />);
    await waitFor(() => expect(productCatalogService.listProducts).toHaveBeenCalled());
    const editProductButton = Array.from(container.querySelectorAll("button")).find((button) => button.title.includes("sản phẩm"));
    fireEvent.click(editProductButton!);
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));

    const editSkuButton = Array.from(container.querySelectorAll("button")).find((button) => button.title.includes("SKU"));
    fireEvent.click(editSkuButton!);
    await waitFor(() => expect(screen.getAllByRole("dialog").filter((dialog) => dialog.parentElement?.className.includes("z-[60]"))).toHaveLength(1));

    const skuDialog = screen.getAllByRole("dialog").find((dialog) => dialog.parentElement?.className.includes("z-[60]"))!;
    expect(screen.getAllByRole("dialog").some((dialog) => !dialog.parentElement?.className.includes("z-[60]"))).toBe(true);
    fireEvent.click(skuDialog.querySelector("button")!);
    await waitFor(() => expect(screen.getAllByRole("dialog").some((dialog) => !dialog.parentElement?.className.includes("z-[60]"))).toBe(true));
  });
});
