import assert from "node:assert/strict";
import test from "node:test";
import { buildInvoiceListQuery, buildOrderListQuery } from "./retail-query.service";

test("order query escapes text and applies date filters", () => {
  const result = buildOrderListQuery(
    { companyCode: "ACME", branchId: "B1" },
    { q: "KH (01)", from: "2026-08-01", to: "2026-08-10", status: "completed" },
  );
  assert.equal(result.filter.companyCode, "ACME");
  assert.equal(result.filter.branchId, "B1");
  assert.equal(result.filter.status, "completed");
  assert.deepEqual(result.filter.businessDate, { $gte: "2026-08-01", $lte: "2026-08-10" });
  assert.equal(result.filter.$or[0].orderCode.$regex, "KH \\(01\\)");
});

test("invoice query remains branch scoped and paginated", () => {
  const result = buildInvoiceListQuery({ companyCode: "ACME", branchId: "B1" }, { q: "HD-1", page: 2, limit: 10 });
  assert.equal(result.filter.companyCode, "ACME");
  assert.equal(result.filter.branchId, "B1");
  assert.equal(result.skip, 10);
  assert.equal(result.limit, 10);
});
