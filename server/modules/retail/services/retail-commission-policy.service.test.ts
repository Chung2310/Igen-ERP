import { beforeEach, describe, expect, it, vi } from "vitest";

const models = vi.hoisted(() => ({
  products: vi.fn(),
  variants: vi.fn(),
  categories: vi.fn(),
  configurations: vi.fn(),
  legacyRules: vi.fn(),
  basePolicies: vi.fn(),
  partners: vi.fn(),
}));

vi.mock("../../../model/product-catalog.model", () => ({ ProductCatalogModel: { find: models.products } }));
vi.mock("../../../model/product-variant.model", () => ({ ProductVariantModel: { find: models.variants } }));
vi.mock("../../../model/product-catalog-resource.model", () => ({ ProductCatalogCategoryModel: { find: models.categories } }));
vi.mock("../models/retail-commission.model", () => ({
  RetailCommissionBasePolicyModel: { find: models.basePolicies },
  RetailCommissionPolicyModel: { find: models.legacyRules },
  RetailProductCommissionModel: { find: models.configurations },
}));
vi.mock("../models/retail-partner.model", () => ({ RetailPartnerModel: { find: models.partners } }));
vi.mock("../../../config/database", () => ({ runInTransaction: vi.fn() }));

import { listRetailBasePolicies, listRetailProductCommissions } from "./retail-commission-policy.service";

function queryResult(value: unknown) {
  const query: any = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(value),
  };
  return query;
}

describe("listRetailProductCommissions assistantItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    models.basePolicies.mockReturnValue(queryResult([]));
  });

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
    models.basePolicies.mockReturnValue(queryResult([{ config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_000 } }]));
    models.partners.mockReturnValue(queryResult([{ _id: partnerId, name: "CTV Minh" }]));

    const result = await listRetailProductCommissions("COMPANY");

    expect(result).toMatchObject({ products, variants, categories, configurations, legacyRules });
    expect(result.assistantItems).toEqual([
      { sku: "PHONE-1", productName: "Điện thoại", variantName: "Bản Titan", categoryCode: "PHONE", categoryName: "Điện thoại", kind: "phone", commissionType: "fixed", commissionValue: 200_000, status: "configured" },
      { sku: "CASE-1", productName: "Điện thoại", variantName: "Ốp lưng", categoryCode: "PHONE", categoryName: "Điện thoại", kind: "accessory", commissionType: "percent", commissionValue: 12.5, ratePercent: 12.5, status: "configured" },
      { sku: "DEFAULT-1", productName: "Điện thoại", variantName: "Mặc định", categoryCode: "PHONE", categoryName: "Điện thoại", kind: "accessory", commissionType: "percent", commissionValue: 10, ratePercent: 10, status: "common" },
      { sku: "PHONE-1", productName: "Điện thoại", variantName: "Bản Titan", categoryCode: "PHONE", categoryName: "Điện thoại", partnerName: "CTV Minh", kind: "sale", commissionType: "percent", commissionValue: 4.5, ratePercent: 4.5, status: "partner-specific" },
    ]);
    expect(JSON.stringify(result.assistantItems)).not.toContain(productId);
    expect(JSON.stringify(result.assistantItems)).not.toContain(partnerId);
    expect(result.assistantItems?.every((item) => !("_id" in item) && !("partnerId" in item) && !("productId" in item))).toBe(true);
    expect(models.partners).toHaveBeenCalledWith({ companyCode: "COMPANY", _id: { $in: [partnerId, "64a000000000000000000003"] } });
  });

  it("shows variants with no effective policy and omits unresolved products or partners", async () => {
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

    await expect(listRetailProductCommissions("COMPANY")).resolves.toMatchObject({ assistantItems: [
      { sku: "NULL-1", status: "no-policy" },
      { sku: "INVALID-1", status: "no-policy" },
    ] });
  });
});

it("joins readable names for base and collaborator-specific commission policy versions", async () => {
  const partnerId = "64a000000000000000000002";
  models.basePolicies.mockReturnValue(queryResult([{ _id: "base-id", partnerId: "", effectiveAt: new Date("2026-11-01T00:00:00Z"), config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_200 } }]));
  models.legacyRules.mockReturnValue(queryResult([{ _id: "legacy-id", partnerId, kind: "sale", sku: "PHONE-1", ratePercent: 5, active: true, effectiveFrom: new Date("2026-11-01T00:00:00Z") }]));
  models.partners.mockReturnValue(queryResult([{ _id: partnerId, name: "Đinh Viết Tường", code: "CTV-1" }]));

  const result = await listRetailBasePolicies("COMPANY");
  expect(result.assistantItems).toEqual([
    expect.objectContaining({ partnerName: "Chính sách chung", scope: "common", config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_200 } }),
    expect.objectContaining({ partnerName: "Đinh Viết Tường", scope: "partner-specific", kind: "sale", sku: "PHONE-1", ratePercent: 5, status: "active" }),
  ]);
  expect(JSON.stringify(result.assistantItems)).not.toContain(partnerId);
});
