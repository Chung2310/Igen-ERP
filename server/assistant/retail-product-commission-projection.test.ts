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

it("calculates a fixed per-unit commission total for the explicitly requested quantity", () => {
  const operation = {
    id: "retail.product-commissions.list",
    module: "retail",
    method: "GET",
    path: "/retail/partners/product-commissions",
    resultFields: ["sku", "productName", "variantName", "kind", "commissionType", "commissionValue", "commissionTotal", "status"],
  } as any;
  const records = projectRecords(operation, { success: true, data: {
    variants: [{ sku: "IP14-TITAN" }],
    assistantItems: [{ sku: "IP14-TITAN", productName: "iPhone 14", variantName: "Titan Sa Mạc", kind: "phone", commissionType: "fixed", commissionValue: 200_000, status: "common" }],
  } }, {} as any, { query_q: "iPhone 14 Titan Sa Mạc", query_quantity: 2 });
  expect(records).toEqual([{
    sku: "IP14-TITAN", productName: "iPhone 14", variantName: "Titan Sa Mạc", kind: "phone",
    commissionType: "fixed", commissionValue: 200_000, status: "common", commissionTotal: 400_000,
  }]);
});

it("projects retail commission policies without exposing internal partner or policy IDs", () => {
  const operation = {
    id: "retail.partner.commission.policy.list",
    module: "retail-partner",
    method: "GET",
    path: "/retail/partners/commission-policies",
    resultFields: ["partnerName", "scope", "kind", "sku", "ratePercent", "effectiveAt", "effectiveFrom", "phoneAmount", "accessoryBps", "repairBps", "status"],
  } as any;
  const records = projectRecords(operation, { success: true, data: {
    assistantItems: [
      { _policyId: "private-policy", partnerId: "private-partner", partnerName: "Đinh Viết Tường", scope: "partner-specific", kind: "sale", sku: "PHONE-1", ratePercent: 5, status: "active" },
      { _policyId: "private-base", partnerName: "Chính sách chung", scope: "common", effectiveAt: "2026-11-01T00:00:00.000Z", config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_200 }, revision: 3 },
    ],
  } }, {} as any);
  expect(records).toEqual([
    { partnerName: "Đinh Viết Tường", scope: "partner-specific", kind: "sale", sku: "PHONE-1", ratePercent: 5, status: "active" },
    { partnerName: "Chính sách chung", scope: "common", effectiveAt: "2026-11-01T00:00:00.000Z", phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_200 },
  ]);
  expect(JSON.stringify(records)).not.toContain("private-");
});
