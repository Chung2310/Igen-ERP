import assert from "node:assert/strict";
import test from "node:test";
import { buildMatrixVariantInput } from "./productVariantPayload";

test("matrix-created SKU keeps customer and supplier warranty months", () => {
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
      warrantyMonths: 12,
      supplierWarrantyMonths: 18,
    },
    productCode: "PHONE",
    baseUnitCode: "PCS",
    productType: "physical",
    fallbackSku: "PHONE-FALLBACK",
  });

  assert.equal(result.warrantyMonths, 12);
  assert.equal(result.supplierWarrantyMonths, 18);
});
