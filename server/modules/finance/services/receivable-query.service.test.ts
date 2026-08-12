import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReceivableListQuery,
  createReceivableQueryService,
  receivableAgingBuckets,
  withRunningReceivableBalance,
} from "./receivable-query.service";

const scope = { companyCode: "ACME", branchId: "B1" };

test("list query preserves actor scope and validates filters and pagination", () => {
  const result = buildReceivableListQuery(scope, {
    status: "partially_paid", customerId: "c1", from: "2026-08-01", to: "2026-08-12", page: "2", limit: "10",
    companyCode: "EVIL", branchId: "B9",
  });
  assert.deepEqual(result.filter, {
    companyCode: "ACME", branchId: "B1", status: "partially_paid", customerId: "c1",
    occurredAt: { $gte: new Date("2026-08-01T00:00:00.000Z"), $lte: new Date("2026-08-12T23:59:59.999Z") },
  });
  assert.deepEqual({ skip: result.skip, limit: result.limit }, { skip: 10, limit: 10 });
  assert.throws(() => buildReceivableListQuery(scope, { status: "deleted" }), /INVALID_STATUS/);
  assert.throws(() => buildReceivableListQuery(scope, { from: "12-08-2026" }), /INVALID_DATE/);
});

test("list query maps exact aging buckets to overdue day ranges", () => {
  assert.deepEqual(buildReceivableListQuery({ companyCode: "ACME", branchId: "B1" }, { agingBucket: "0-30" }).filter.daysOverdue, { $gte: 0, $lte: 30 });
  assert.deepEqual(buildReceivableListQuery({ companyCode: "ACME", branchId: "B1" }, { agingBucket: "31-60" }).filter.daysOverdue, { $gte: 31, $lte: 60 });
  assert.deepEqual(buildReceivableListQuery({ companyCode: "ACME", branchId: "B1" }, { agingBucket: "61-90" }).filter.daysOverdue, { $gte: 61, $lte: 90 });
  assert.deepEqual(buildReceivableListQuery({ companyCode: "ACME", branchId: "B1" }, { agingBucket: "over90" }).filter.daysOverdue, { $gte: 91 });
  assert.throws(() => buildReceivableListQuery({ companyCode: "ACME", branchId: "B1" }, { agingBucket: "invalid" }), /INVALID_AGING_BUCKET/);
});

test("running balances are chronological even when entries arrive newest first", () => {
  const entries = withRunningReceivableBalance([
    { _id: "e3", createdAt: "2026-08-03", amount: -20 },
    { _id: "e1", createdAt: "2026-08-01", amount: 100 },
    { _id: "e2", createdAt: "2026-08-02", amount: 10 },
  ]);
  assert.deepEqual(entries.map((item) => [item._id, item.runningBalance]), [["e1", 100], ["e2", 110], ["e3", 90]]);
});

test("aging uses exact 0-30, 31-60, 61-90, and over90 boundaries", () => {
  const result = receivableAgingBuckets([
    { daysOverdue: 0, balance: 10 }, { daysOverdue: 30, balance: 20 },
    { daysOverdue: 31, balance: 30 }, { daysOverdue: 60, balance: 40 },
    { daysOverdue: 61, balance: 50 }, { daysOverdue: 90, balance: 60 },
    { daysOverdue: 91, balance: 70 },
  ]);
  assert.deepEqual(result, {
    "0-30": { count: 2, balance: 30 }, "31-60": { count: 2, balance: 70 },
    "61-90": { count: 2, balance: 110 }, over90: { count: 1, balance: 70 },
  });
});

test("query service scopes list, detail, aging, and customer totals", async () => {
  const calls: any[] = [];
  const service = createReceivableQueryService({
    async list(filter, options) { calls.push(["list", filter, options]); return { items: [], total: 0 }; },
    async detail(filter) { calls.push(["detail", filter]); return { receivable: { _id: filter._id }, entries: [] }; },
    async aging(filter) { calls.push(["aging", filter]); return []; },
    async byCustomer(filter) { calls.push(["customer", filter]); return []; },
  });
  await service.list(scope, { page: 1, limit: 20 });
  await service.detail(scope, "r1");
  await service.aging(scope);
  await service.byCustomer(scope, "c1");
  assert.equal(calls.every((call) => call[1].companyCode === "ACME" && call[1].branchId === "B1"), true);
  assert.deepEqual(calls[1][1], { companyCode: "ACME", branchId: "B1", _id: "r1" });
  assert.deepEqual(calls[3][1], { companyCode: "ACME", branchId: "B1", customerId: "c1" });
});
