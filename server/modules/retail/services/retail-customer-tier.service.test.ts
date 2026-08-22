import assert from "node:assert/strict";
import test from "node:test";
import * as tierService from "./retail-customer-tier.service";

test("builds company-wide order filters for all tier evaluation windows", () => {
  const build = (tierService as any).buildTierSalesFilter;
  assert.deepEqual(build("ACME", "c1", { type: "lifetime" }, new Date("2026-08-12T00:00:00Z")), { companyCode: "ACME", customerId: "c1", status: { $in: ["confirmed", "completed"] } });
  assert.deepEqual(build("ACME", "c1", { type: "rolling12Months" }, new Date("2026-08-12T00:00:00Z")).businessDate, { $gte: "2025-08-12", $lte: "2026-08-12" });
  assert.deepEqual(build("ACME", "c1", { type: "custom", from: "2026-01-01", to: "2026-06-30" }, new Date()).businessDate, { $gte: "2026-01-01", $lte: "2026-06-30" });
});

test("tier sales filter is not scoped to a single branch", () => {
  const filter = (tierService as any).buildTierSalesFilter("ACME", "c1", { type: "lifetime" }, new Date());
  assert.equal("branchId" in filter, false);
});

test("net tier sales exclude cancelled orders and subtract refunds", () => {
  const total = (tierService as any).calculateTierNetSales;
  assert.equal(total([{ status: "completed", grandTotal: 100, refundedAmount: 30 }, { status: "confirmed", grandTotal: 50, refundedAmount: 0 }, { status: "cancelled", grandTotal: 999, refundedAmount: 0 }]), 120);
});

test("retry sweep only picks up unfinished jobs with attempts left", async () => {
  const calls: string[] = [];
  const jobModel = (await import("../models/retail-customer-tier-job.model") as any).RetailCustomerTierJobModel;
  const original = jobModel.find;
  jobModel.find = (filter: any) => {
    calls.push(JSON.stringify(filter));
    const chain: any = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => [] };
    return chain;
  };
  try {
    const result = await (tierService as any).processPendingTierRefreshJobs();
    assert.deepEqual(result, { processed: 0, failed: 0 });
  } finally { jobModel.find = original; }
  const filter = JSON.parse(calls[0]);
  assert.deepEqual(filter.status, { $in: ["pending", "failed"] });
  assert.deepEqual(filter.attempts, { $lt: (tierService as any).TIER_JOB_MAX_ATTEMPTS });
});

test("tier job and history models enforce retry-safe source keys", async () => {
  const job = (await import("../models/retail-customer-tier-job.model") as any).RetailCustomerTierJobModel;
  const history = (await import("../models/retail-customer-tier-history.model") as any).RetailCustomerTierHistoryModel;
  assert.ok(job.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
  assert.ok(history.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
});
