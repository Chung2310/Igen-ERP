import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPageErpContext } from "./page-erp-context.service";
import { getModuleStateForCompany, isServiceSubscriptionBlocked } from "../../../../middleware/require-module";
import { ProductCatalogModel } from "../../../../model/product-catalog.model";
import { ProductPriceModel } from "../../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../../model/inventory-balance.model";

vi.mock("../../../../middleware/require-module", () => ({
  getModuleStateForCompany: vi.fn(), isServiceSubscriptionBlocked: vi.fn(() => false),
}));
vi.mock("../../../../model/product-catalog.model", () => ({ ProductCatalogModel: { find: vi.fn() } }));
vi.mock("../../../../model/product-price.model", () => ({ ProductPriceModel: { find: vi.fn() } }));
vi.mock("../../../../model/inventory-balance.model", () => ({ InventoryBalanceModel: { find: vi.fn() } }));
describe("Page ERP context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: ["inventory", "retail"] } as any);
    vi.mocked(isServiceSubscriptionBlocked).mockReturnValue(false);
    vi.mocked(ProductCatalogModel.find).mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [
      { _id: "P1", productCode: "SON01", name: "Sơn nội thất", productType: "physical" },
    ] }) }) } as any);
    vi.mocked(InventoryBalanceModel.find).mockReturnValue({ select: () => ({ lean: async () => [
      { productId: "P1", quantity: 10, reservedQuantity: 2 },
    ] }) } as any);
    vi.mocked(ProductPriceModel.find).mockReturnValue({ select: () => ({ lean: async () => [
      { productId: "P1", sellingPrice: 120000 },
    ] }) } as any);
  });
  it("reads price and available stock only within the tenant", async () => {
    const context = await getPageErpContext("acme", "Giá sơn nội thất bao nhiêu?");
    expect(context).toContain('"availableAcrossBranches":8');
    expect(context).toContain('"sellingPriceVnd":120000');
    expect(ProductCatalogModel.find).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", status: "active" }));
    expect(ProductPriceModel.find).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", status: "active" }));
  });
  it("does not query products when inventory is disabled", async () => {
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: ["retail"] } as any);
    expect(await getPageErpContext("ACME", "Giá sơn nội thất?")).toBe("");
    expect(ProductCatalogModel.find).not.toHaveBeenCalled();
  });
  it("does not expose a price when retail is disabled", async () => {
    vi.mocked(getModuleStateForCompany).mockResolvedValue({ exists: true, modules: ["inventory"] } as any);
    const context = await getPageErpContext("ACME", "Giá sơn nội thất?");
    expect(context).toContain('"priceStatus":"retail_module_disabled"');
    expect(ProductPriceModel.find).not.toHaveBeenCalled();
  });
});
