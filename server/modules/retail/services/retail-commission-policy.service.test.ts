import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  products: vi.fn(),
  variants: vi.fn(),
  categories: vi.fn(),
  configurations: vi.fn(),
  legacyRules: vi.fn(),
  partners: vi.fn(),
}));

vi.mock("../../../model/product-catalog.model", () => ({ ProductCatalogModel: { find: models.products } }));
vi.mock("../../../model/product-variant.model", () => ({ ProductVariantModel: { find: models.variants } }));
vi.mock("../../../model/product-catalog-resource.model", () => ({ ProductCatalogCategoryModel: { find: models.categories } }));
vi.mock("../models/retail-commission.model", () => ({
  RetailCommissionBasePolicyModel: {},
  RetailCommissionPolicyModel: { find: models.legacyRules },
  RetailProductCommissionModel: { find: models.configurations },
}));
vi.mock("../models/retail-partner.model", () => ({ RetailPartnerModel: { find: models.partners } }));
vi.mock("../../../config/database", () => ({ runInTransaction: vi.fn() }));

import { listRetailProductCommissions } from "./retail-commission-policy.service";

function queryResult(value: unknown) {
  const query: any = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(value),
  };
  return query;
}

describe("listRetailProductCommissions assistantItems", () => {
  beforeEach(() => vi.clearAllMocks());

  it("joins SKU/product and legacy partner names without adding IDs or changing UI collections", async () => {
    const productId = "64a000000000000000000001";
    const partnerId = "64a000000000000000000002";
    const products = [{ _id: productId, name: "Điện thoại", categoryCode: "PHONE" }];
    const variants = [
      { productId, sku: "PHONE-1", displayName: "Bản Titan", trackingMode: "serial" },
      { productId, sku: "CASE-1", displayName: "Ốp lưng", trackingMode: "quantity" },
      { productId, sku: "DEFAULT-1", displayName: "Mặc định", trackingMode: "quantity" },
    ];
    const categories = [{ code: "PHONE", name: "Điện thoại" }];
    const configurations = [
      { sku: "PHONE-1", rule: { kind: "phone", amount: 200_000 } },
      { sku: "CASE-1", rule: { kind: "accessory", rateBps: 1_250 } },
      { sku: "DEFAULT-1", rule: null },
    ];
    const legacyRules = [
      { sku: "PHONE-1", partnerId, kind: "sale", ratePercent: 4.5, active: true },
      { sku: "CASE-1", partnerId: "64a000000000000000000003", kind: "sale", ratePercent: 7, active: true },
    ];
    models.products.mockReturnValue(queryResult(products));
    models.variants.mockReturnValue(queryResult(variants));
    models.categories.mockReturnValue(queryResult(categories));
    models.configurations.mockReturnValue(queryResult(configurations));
    models.legacyRules.mockReturnValue(queryResult(legacyRules));
    models.partners.mockReturnValue(queryResult([{ _id: partnerId, name: "CTV Minh" }]));

    const result = await listRetailProductCommissions("COMPANY");

    expect(result).toMatchObject({ products, variants, categories, configurations, legacyRules });
    expect(result.assistantItems).toEqual([
      { sku: "PHONE-1", productName: "Điện thoại", kind: "phone", commissionType: "fixed", commissionValue: 200_000, status: "configured" },
      { sku: "CASE-1", productName: "Điện thoại", kind: "accessory", commissionType: "percent", commissionValue: 12.5, ratePercent: 12.5, status: "configured" },
      { sku: "PHONE-1", productName: "Điện thoại", partnerName: "CTV Minh", kind: "sale", commissionType: "percent", commissionValue: 4.5, ratePercent: 4.5, status: "active" },
    ]);
    expect(JSON.stringify(result.assistantItems)).not.toContain(productId);
    expect(JSON.stringify(result.assistantItems)).not.toContain(partnerId);
    expect(result.assistantItems?.every((item) => !("_id" in item) && !("partnerId" in item) && !("productId" in item))).toBe(true);
    expect(models.partners).toHaveBeenCalledWith({ companyCode: "COMPANY", _id: { $in: [partnerId, "64a000000000000000000003"] } });
  });

  it("omits rows with invalid rules, unresolved product names, or unresolved legacy partners", async () => {
    models.products.mockReturnValue(queryResult([{ _id: "product", name: "Máy" }]));
    models.variants.mockReturnValue(queryResult([
      { productId: "product", sku: "NULL-1" },
      { productId: "product", sku: "INVALID-1" },
      { productId: "missing-product", sku: "NO-PRODUCT" },
    ]));
    models.categories.mockReturnValue(queryResult([]));
    models.configurations.mockReturnValue(queryResult([
      { sku: "NULL-1", rule: null },
      { sku: "INVALID-1", rule: { kind: "phone", amount: -1 } },
    ]));
    models.legacyRules.mockReturnValue(queryResult([{ sku: "NULL-1", partnerId: "missing-partner", kind: "sale", ratePercent: 8, active: true }]));
    models.partners.mockReturnValue(queryResult([]));

    await expect(listRetailProductCommissions("COMPANY")).resolves.toMatchObject({ assistantItems: [] });
  });
});
