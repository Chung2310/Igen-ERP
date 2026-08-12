import assert from "node:assert/strict";
import test from "node:test";
import * as queryService from "./retail-receivable-query.service";

test("receivable history query keeps branch and customer scope with validated filters", () => {
  const build = (queryService as any).buildRetailReceivableHistoryQuery;
  assert.equal(typeof build, "function");
  const result = build({ companyCode: "ACME", branchId: "B1" }, "customer-1", { type: "payment", from: "2026-08-01", to: "2026-08-12", page: "2", limit: "10" });
  assert.deepEqual(result.filter, {
    companyCode: "ACME", branchId: "B1", customerId: "customer-1", type: "payment",
    createdAt: { $gte: new Date("2026-08-01T00:00:00.000Z"), $lte: new Date("2026-08-12T23:59:59.999Z") },
  });
  assert.deepEqual({ page: result.page, limit: result.limit, skip: result.skip }, { page: 2, limit: 10, skip: 10 });
});

test("running balances are chronological even when the page is returned newest first", () => {
  const balances = (queryService as any).withRunningReceivableBalance;
  assert.equal(typeof balances, "function");
  assert.deepEqual(balances([
    { _id: "e3", createdAt: "2026-08-03", signedAmount: -30 },
    { _id: "e2", createdAt: "2026-08-02", signedAmount: 20 },
    { _id: "e1", createdAt: "2026-08-01", signedAmount: 100 },
  ], 0).map((entry: any) => [entry._id, entry.runningBalance]), [["e3", 90], ["e2", 120], ["e1", 100]]);
});

test("history pipeline calculates running balance before applying display filters", () => {
  const pipeline = (queryService as any).buildReceivableHistoryPipeline(
    { companyCode: "ACME", branchId: "B1", customerId: "c1" },
    { type: "payment" },
    10,
    20,
  );
  assert.equal(typeof pipeline, "object");
  const windowIndex = pipeline.findIndex((stage: any) => stage.$setWindowFields);
  const filterIndex = pipeline.findIndex((stage: any) => stage.$match?.type === "payment");
  assert.ok(windowIndex >= 0 && filterIndex > windowIndex);
  assert.deepEqual(pipeline.at(-1), { $limit: 20 });
});

test("receivable history rejects invalid type and dates", () => {
  const build = (queryService as any).buildRetailReceivableHistoryQuery;
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { type: "delete" }));
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { from: "12-08-2026" }));
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { from: "2026-08-12", to: "2026-08-01" }));
});
