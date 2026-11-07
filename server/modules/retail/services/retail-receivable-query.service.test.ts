import assert from "node:assert/strict";
import test from "node:test";
import * as queryService from "./retail-receivable-query.service";
import { RetailReceivableEntryModel } from "../models/retail-receivable-entry.model";

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

test("receivable history rejects invalid type and dates", () => {
  const build = (queryService as any).buildRetailReceivableHistoryQuery;
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { type: "delete" }));
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { from: "12-08-2026" }));
  assert.throws(() => build({ companyCode: "ACME", branchId: "B1" }, "c1", { from: "2026-08-12", to: "2026-08-01" }));
});

test("customer debt history keeps balances with filtered entries when window stages are unavailable", async (t) => {
  const entries = [
    { _id: "e3", type: "payment", createdAt: new Date("2026-08-03T00:00:00Z"), signedAmount: -50 },
    { _id: "e2", type: "payment", createdAt: new Date("2026-08-02T00:00:00Z"), signedAmount: -30 },
  ];
  t.mock.method(RetailReceivableEntryModel, "find", () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => entries }) }) }) }) as any);
  t.mock.method(RetailReceivableEntryModel, "countDocuments", async () => 2);
  t.mock.method(RetailReceivableEntryModel, "aggregate", async (pipeline: any[]) => {
    if (pipeline.some((stage) => stage.$setWindowFields)) throw new Error("Unrecognized pipeline stage name: '$setWindowFields'");
    return [{ balance: pipeline[0]?.$match?.$or ? 50 : 70 }];
  });
  const result = await queryService.RetailReceivableQueryService.history({ companyCode: "ACME", branchId: "B1" }, "c1", { type: "payment" });
  assert.equal(result.currentBalance, 70);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items.map((entry: any) => [entry._id, entry.runningBalance]), [["e3", 20], ["e2", 70]]);
});
