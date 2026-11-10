import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryBalanceModel } from "../../../../model/inventory-balance.model";
import { ProductCatalogModel } from "../../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../../model/product-variant.model";
import { WarehouseModel } from "../../../../model/warehouse.model";
import { checkCakeStockAtBranch } from "./cake-stock-availability";

vi.mock("../../../../model/inventory-balance.model", () => ({ InventoryBalanceModel: { find: vi.fn() } }));
vi.mock("../../../../model/product-catalog.model", () => ({ ProductCatalogModel: { findOne: vi.fn() } }));
vi.mock("../../../../model/product-variant.model", () => ({ ProductVariantModel: { findOne: vi.fn() } }));
vi.mock("../../../../model/warehouse.model", () => ({ WarehouseModel: { findOne: vi.fn() } }));

const one = (value: unknown) => ({ select: () => ({ lean: async () => value }) });
const many = (value: unknown[]) => ({ select: () => ({ lean: async () => value }) });

describe("cake stock check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not claim stock for a product that is not inventory-tracked", async () => {
    vi.mocked(ProductVariantModel.findOne).mockReturnValue(one({ _id: "V1", productId: "P1", trackingMode: "none" }) as any);
    expect(await checkCakeStockAtBranch({ companyCode: "acme", branchId: "B1", sku: "BV1", quantity: 1 }))
      .toEqual({ status: "untracked" });
    expect(ProductCatalogModel.findOne).not.toHaveBeenCalled();
  });

  it("subtracts reserved quantity before confirming available stock", async () => {
    vi.mocked(ProductVariantModel.findOne).mockReturnValue(one({ _id: "V1", productId: "P1", trackingMode: "quantity" }) as any);
    vi.mocked(ProductCatalogModel.findOne).mockReturnValue(one({ productType: "physical" }) as any);
    vi.mocked(WarehouseModel.findOne).mockReturnValue(one({ _id: "W1" }) as any);
    vi.mocked(InventoryBalanceModel.find).mockReturnValue(many([{ quantity: 7, reservedQuantity: 2 }]) as any);
    expect(await checkCakeStockAtBranch({ companyCode: "acme", branchId: "B1", sku: "BV1", quantity: 5 }))
      .toEqual({ status: "available", availableQuantity: 5 });
  });

  it("reports insufficient stock and missing warehouse data without guessing", async () => {
    vi.mocked(ProductVariantModel.findOne).mockReturnValue(one({ _id: "V1", productId: "P1", trackingMode: "quantity" }) as any);
    vi.mocked(ProductCatalogModel.findOne).mockReturnValue(one({ productType: "physical" }) as any);
    vi.mocked(WarehouseModel.findOne).mockReturnValue(one({ _id: "W1" }) as any);
    vi.mocked(InventoryBalanceModel.find).mockReturnValue(many([{ quantity: 3, reservedQuantity: 2 }]) as any);
    expect(await checkCakeStockAtBranch({ companyCode: "acme", branchId: "B1", sku: "BV1", quantity: 2 }))
      .toEqual({ status: "insufficient", availableQuantity: 1 });
    vi.mocked(WarehouseModel.findOne).mockReturnValue(one(null) as any);
    expect(await checkCakeStockAtBranch({ companyCode: "acme", branchId: "B1", sku: "BV1", quantity: 1 }))
      .toEqual({ status: "unknown" });
  });
});
