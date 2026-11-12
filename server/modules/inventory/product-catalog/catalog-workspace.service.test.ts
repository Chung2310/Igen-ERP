import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyModel } from "../../../model/company.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { ProductModel } from "../../../model/product.model";
import { SerialUnitModel } from "../serials/serial-unit.model";
import { readCatalogBranchSummaries, readCatalogWorkspace, updateCatalogWorkspace } from "./catalog-workspace.service";

vi.mock("../../../model/company.model", () => ({ CompanyModel: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("../../../model/product-catalog.model", () => ({ ProductCatalogModel: { exists: vi.fn() } }));
vi.mock("../../../model/product-variant.model", () => ({ ProductVariantModel: { exists: vi.fn(), find: vi.fn() } }));
vi.mock("../../../model/product-price.model", () => ({ ProductPriceModel: { find: vi.fn() } }));
vi.mock("../../../model/inventory-balance.model", () => ({ InventoryBalanceModel: { find: vi.fn() } }));
vi.mock("../../../model/warehouse.model", () => ({ WarehouseModel: { find: vi.fn() } }));
vi.mock("../../../model/product.model", () => ({ ProductModel: { exists: vi.fn() } }));
vi.mock("../serials/serial-unit.model", () => ({ SerialUnitModel: { exists: vi.fn() } }));

const result = (value: unknown) => ({ select: () => ({ lean: async () => value }) }) as never;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(CompanyModel.findOne).mockReturnValue(result({ businessType: "service" }));
});

describe("catalog workspace", () => {
  it("suggests a mixed workspace when legacy goods and current services coexist", async () => {
    vi.mocked(ProductCatalogModel.exists).mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "service" } as never);
    vi.mocked(ProductModel.exists).mockResolvedValue({ _id: "legacy" } as never);
    expect(await readCatalogWorkspace("ACME")).toEqual({ mode: "mixed", configured: false, hasSerial: false });
  });

  it("validates and persists mode only for the current company", async () => {
    await expect(updateCatalogWorkspace("ACME", "anything")).rejects.toMatchObject({ statusCode: 400 });
    expect(CompanyModel.updateOne).not.toHaveBeenCalled();
    vi.mocked(CompanyModel.findOne).mockReturnValue(result({ inventoryWorkspaceMode: "services" }));
    vi.mocked(CompanyModel.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
    vi.mocked(SerialUnitModel.exists).mockResolvedValue({ _id: "previous-serial" } as never);
    expect(await updateCatalogWorkspace("ACME", "services")).toEqual({ mode: "services", configured: true, hasSerial: true });
    expect(CompanyModel.updateOne).toHaveBeenCalledWith({ code: "ACME" }, { $set: { inventoryWorkspaceMode: "services" } }, { runValidators: true });
  });

  it("reads scoped selling balances and distinguishes service, zero stock and zero price", async () => {
    const products = [
      { _id: "goods", productType: "physical" },
      { _id: "empty", productType: "physical" },
      { _id: "free", productType: "service", serviceBranchIds: ["A"] },
      { _id: "other", productType: "service", serviceBranchIds: ["B"] },
    ];
    vi.mocked(ProductVariantModel.find).mockReturnValue(result(products.map(product => ({
      _id: product._id + "-sku", productId: product._id, trackingMode: product.productType === "service" ? "none" : "quantity",
    }))));
    vi.mocked(WarehouseModel.find).mockReturnValue(result([{ _id: "selling" }]));
    vi.mocked(InventoryBalanceModel.find).mockReturnValue(result([{ variantId: "goods-sku", quantity: 8, reservedQuantity: 3 }]));
    vi.mocked(ProductPriceModel.find).mockReturnValue(result([
      { variantId: "goods-sku", sellingPrice: 45_000 }, { variantId: "free-sku", sellingPrice: 0 }, { variantId: "other-sku", sellingPrice: 1 },
    ]));

    const rows = await readCatalogBranchSummaries("ACME", "A", products);
    expect(rows.get("goods")).toEqual({ sellingPriceMin: 45_000, sellingPriceMax: 45_000, availableStock: 5 });
    expect(rows.get("empty")).toEqual({ sellingPriceMin: null, sellingPriceMax: null, availableStock: 0 });
    expect(rows.get("free")).toEqual({ sellingPriceMin: 0, sellingPriceMax: 0, availableStock: null });
    expect(rows.get("other")).toEqual({ sellingPriceMin: null, sellingPriceMax: null, availableStock: null });
    expect(WarehouseModel.find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "A", kind: "selling", isActive: true });
    expect(InventoryBalanceModel.find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "A",
      warehouseId: { $in: ["selling"] }, variantId: { $in: ["goods-sku", "empty-sku"] } });
  });
});
