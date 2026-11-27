import { expect, it, vi } from "vitest";

vi.mock("./workflows", () => ({ actorScope: () => ({}), assertOperation: vi.fn() }));

import { projectRecords } from "./executor";

it("projects the dedicated retail product commission rows instead of raw product variants", () => {
  const operation = {
    id: "retail.product-commissions.list",
    module: "retail",
    method: "GET",
    path: "/retail/partners/product-commissions",
    resultFields: ["sku", "productName", "partnerName", "kind", "commissionType", "commissionValue", "ratePercent", "status"],
  } as any;

  const records = projectRecords(operation, { success: true, data: {
    variants: [{ sku: "SKU-1", displayName: "Biến thể màn hình" }],
    assistantItems: [
      { sku: "SKU-1", productName: "Điện thoại A", partnerName: "Cộng tác viên B", kind: "sale", commissionType: "percentage", commissionValue: 5, ratePercent: 5, status: "active", partnerId: "internal-id", revision: 7 },
      { sku: "SKU-2", productName: "Ốp lưng C", kind: "accessory", commissionType: "percentage", commissionValue: 10, ratePercent: 10, status: "active", secret: "hidden" },
    ],
  } }, {} as any);

  expect(records).toEqual([
    { sku: "SKU-1", productName: "Điện thoại A", partnerName: "Cộng tác viên B", kind: "sale", commissionType: "percentage", commissionValue: 5, ratePercent: 5, status: "active" },
    { sku: "SKU-2", productName: "Ốp lưng C", kind: "accessory", commissionType: "percentage", commissionValue: 10, ratePercent: 10, status: "active" },
  ]);
});

it("adds public configuration counts for overview requests", () => {
  const operation = {
    id: "retail.product-commissions.list",
    module: "retail",
    method: "GET",
    path: "/retail/partners/product-commissions",
    resultFields: ["productCategoryCount", "productCount", "variantCount", "configuredSkuCount", "sku", "productName", "status"],
  } as any;

  const records = projectRecords(operation, { success: true, data: {
    categories: [{ code: "PHONE" }, { code: "ACCESSORY" }],
    products: [{ name: "Điện thoại A" }, { name: "Ốp lưng B" }],
    variants: [{ sku: "PHONE-1" }, { sku: "CASE-1" }, { sku: "CASE-2" }],
    assistantItems: [
      { sku: "PHONE-1", productName: "Điện thoại A", status: "configured" },
      { sku: "CASE-1", productName: "Ốp lưng B", status: "active" },
    ],
  } }, {} as any);

  expect(records[0]).toEqual({ productCategoryCount: 2, productCount: 2, variantCount: 3, configuredSkuCount: 1 });
  expect(records.slice(1)).toEqual([
    { sku: "PHONE-1", productName: "Điện thoại A", status: "configured" },
    { sku: "CASE-1", productName: "Ốp lưng B", status: "active" },
  ]);
});
