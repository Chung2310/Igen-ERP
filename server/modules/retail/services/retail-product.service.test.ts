import assert from "node:assert/strict";
import test from "node:test";
import { buildRetailProductFilter, matchesScannedUnit, normalizeRetailProductSearch } from "./retail-product.service";

test("product lookup always keeps exact company and branch scope", () => {
  const filter = buildRetailProductFilter(
    { companyCode: "ACME", branchId: "branch-1" },
    { q: " ao (do) ", limit: "500" },
  );

  assert.equal(filter.scope.companyCode, "ACME");
  assert.equal(filter.scope.branchId, "branch-1");
  assert.equal(filter.limit, 100);
  assert.equal(filter.search, "ao \\(do\\)");
});

test("barcode lookup is exact and normalized", () => {
  assert.deepEqual(normalizeRetailProductSearch({ barcode: " 893123 " }), {
    q: "",
    barcode: "893123",
    page: 1,
    limit: 20,
  });
});

test("scanned serial unit matches its variant, or its product when variant is absent", () => {
  assert.equal(matchesScannedUnit(null, { _id: "v1", productId: "p1" }), false);
  assert.equal(matchesScannedUnit({ variantId: "v1", productId: "p1" }, { _id: "v1", productId: "p1" }), true);
  assert.equal(matchesScannedUnit({ variantId: "v2", productId: "p1" }, { _id: "v1", productId: "p1" }), false);
  assert.equal(matchesScannedUnit({ productId: "p1" }, { _id: "v1", productId: "p1" }), true);
  assert.equal(matchesScannedUnit({ productId: "p2" }, { _id: "v1", productId: "p1" }), false);
});
