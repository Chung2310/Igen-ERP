import assert from "node:assert/strict";
import test from "node:test";
import { buildRetailProductFilter, normalizeRetailProductSearch } from "./retail-product.service";

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
