import assert from "node:assert/strict";
import test from "node:test";
import { buildMatrixVariantInput } from "./productVariantPayload";

test("matrix-created SKU keeps supplier warranty without duplicating product customer warranty", () => {
  const result = buildMatrixVariantInput({
    row: {
      sku: "PHONE-BLACK",
      barcode: "8930000000001",
      optionValues: [{ code: "COLOR", value: "Black" }],
      weightGrams: 200,
      mediaIds: ["image-1"],
    },
    shared: {
      unitCode: "PCS",
      trackingMode: "serial",
      supplierWarrantyMonths: 18,
    },
    productCode: "PHONE",
    baseUnitCode: "PCS",
    productType: "physical",
    fallbackSku: "PHONE-FALLBACK",
  });

  assert.equal(result.warrantyMonths, undefined);
  assert.equal(result.supplierWarrantyMonths, 18);
});
