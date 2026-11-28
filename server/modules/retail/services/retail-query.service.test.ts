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

test("cancelled order query filters by Vietnam cancellation time and status", () => {
  const result = buildOrderListQuery(
    { companyCode: "ACME", branchId: "B1" },
    { cancelledFrom: "2026-11-27", cancelledTo: "2026-11-27", from: "2026-10-01", to: "2026-10-31" },
  );
  assert.equal(result.filter.companyCode, "ACME");
  assert.equal(result.filter.branchId, "B1");
  assert.equal(result.filter.status, "cancelled");
  assert.deepEqual(result.filter.cancelledAt, {
    $gte: new Date("2026-11-27T00:00:00+07:00"),
    $lte: new Date("2026-11-27T23:59:59.999+07:00"),
  });
  assert.deepEqual(result.filter.businessDate, { $gte: "2026-10-01", $lte: "2026-10-31" });
});

test("cancelled order query rejects invalid or reversed dates", () => {
  assert.throws(() => buildOrderListQuery({ companyCode: "ACME", branchId: "B1" }, { cancelledFrom: "2026-02-30" }), /YYYY-MM-DD/);
  assert.throws(() => buildOrderListQuery({ companyCode: "ACME", branchId: "B1" }, { cancelledFrom: "2026-11-28", cancelledTo: "2026-11-27" }), /không được sau/);
});

test("invoice query remains branch scoped and paginated", () => {
  const result = buildInvoiceListQuery({ companyCode: "ACME", branchId: "B1" }, { q: "HD-1", page: 2, limit: 10 });
  assert.equal(result.filter.companyCode, "ACME");
  assert.equal(result.filter.branchId, "B1");
  assert.equal(result.skip, 10);
  assert.equal(result.limit, 10);
});
