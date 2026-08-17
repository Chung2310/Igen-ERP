import assert from "node:assert/strict";
import test from "node:test";
import {
  ProductCatalogValidationError,
  assertTemplateAttributes,
  assertNoForbiddenCatalogFields,
  codeFromName,
  normalizeCode,
  normalizeCompanyCode,
  normalizeProductInput,
  normalizeVariantInput,
} from "./product-catalog.service";

test("catalog scope and codes are normalized centrally", () => {
  assert.equal(normalizeCompanyCode(" acme "), "ACME");
  assert.equal(normalizeCode(" sku-001 ", "SKU"), "SKU-001");
  assert.throws(() => normalizeCompanyCode("  "), ProductCatalogValidationError);
  assert.equal(codeFromName("CAT", "Thực phẩm & Đồ uống"), "CAT-THUC-PHAM-DO-UONG");
});

test("catalog rejects branch and stock fields", () => {
  assert.throws(() => assertNoForbiddenCatalogFields({ branchId: "branch-1" }), ProductCatalogValidationError);
  assert.throws(() => assertNoForbiddenCatalogFields({ price: 100 }), /không ghi trong danh mục/);
});

test("variant validation keeps service products out of stock tracking", () => {
  const serviceVariant = normalizeVariantInput({ sku: "SVC-001", unitCode: "HOUR" }, "service");
  assert.equal(serviceVariant.trackingMode, "none");

  assert.throws(
    () => normalizeVariantInput({ sku: "SVC-002", unitCode: "HOUR", trackingMode: "lot" }, "service"),
    ProductCatalogValidationError,
  );
});

test("physical variants default to none and allow serial tracking", () => {
  const defaultVariant = normalizeVariantInput({ sku: "SKU-001", unitCode: "PCS" }, "physical");
  assert.equal(defaultVariant.trackingMode, "none");

  const untrackedVariant = normalizeVariantInput({ sku: "SKU-002", unitCode: "PCS", trackingMode: "none" }, "physical");
  assert.equal(untrackedVariant.trackingMode, "none");

  const variant = normalizeVariantInput({ sku: "SKU-001", unitCode: "PCS", trackingMode: "serial" }, "physical");
  assert.equal(variant.sku, "SKU-001");
  assert.equal(variant.trackingMode, "serial");

  const quantityVariant = normalizeVariantInput({ sku: "SKU-003", unitCode: "PCS", trackingMode: "quantity" }, "physical");
  assert.equal(quantityVariant.trackingMode, "quantity");
});

test("variant identity is normalized and lifecycle values are constrained", () => {
  const variant = normalizeVariantInput({ sku: " sku-002 ", barcode: " 8930001 ", unitCode: " pcs ", trackingMode: "serial", status: "inactive" }, "physical");
  assert.equal(variant.sku, "SKU-002");
  assert.equal(variant.barcode, "8930001");
  assert.equal(variant.unitCode, "PCS");
  assert.equal(variant.status, "inactive");
  assert.throws(() => normalizeVariantInput({ sku: "SKU-003", unitCode: "PCS", status: "removed" }, "physical"), /Trạng thái SKU/);
});

test("product defaults to draft and validates template-required attributes", () => {
  const product = normalizeProductInput({
    productCode: "P-001",
    name: "Thiết bị",
    productType: "physical",
    templateCode: "ELECTRONICS",
    categoryCode: "ELECTRONICS",
    baseUnitCode: "PCS",
  });
  assert.equal(product.status, "draft");
  const productWithoutCode = normalizeProductInput({
    name: "Điện thoại mẫu",
    productType: "physical",
    categoryCode: "PHONE",
    baseUnitCode: "UOM-CAI",
  });
  assert.equal(productWithoutCode.productCode, undefined);
  const productWithoutTemplate = normalizeProductInput({
    productCode: "P-002",
    name: "Sản phẩm cơ bản",
    productType: "physical",
    categoryCode: "GENERAL",
    baseUnitCode: "PCS",
  });
  assert.equal(productWithoutTemplate.templateCode, undefined);
  assert.equal(normalizeProductInput({ brandCode: null }, true).brandCode, null);
  assert.throws(
    () => assertTemplateAttributes({ fields: [{ code: "RAM", label: "RAM", type: "text", required: true, options: [] }] }, []),
    /Thiếu thuộc tính bắt buộc/,
  );
  assert.doesNotThrow(() => assertTemplateAttributes({ fields: [{ code: "RAM", label: "RAM", type: "text", required: true, options: [] }] }, [{ code: "RAM", value: "16GB" }]));
});
