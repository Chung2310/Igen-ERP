import assert from "node:assert/strict";
import test from "node:test";
import * as tierService from "./retail-customer-tier.service";

test("builds scoped order filters for all tier evaluation windows", () => {
  const build = (tierService as any).buildTierSalesFilter;
  const scope = { companyCode: "ACME", branchId: "B1" };
  assert.deepEqual(build(scope, "c1", { type: "lifetime" }, new Date("2026-08-12T00:00:00Z")), { ...scope, customerId: "c1", status: { $in: ["confirmed", "completed"] } });
  assert.deepEqual(build(scope, "c1", { type: "rolling12Months" }, new Date("2026-08-12T00:00:00Z")).businessDate, { $gte: "2025-08-12", $lte: "2026-08-12" });
  assert.deepEqual(build(scope, "c1", { type: "custom", from: "2026-01-01", to: "2026-06-30" }, new Date()).businessDate, { $gte: "2026-01-01", $lte: "2026-06-30" });
});

test("net tier sales exclude cancelled orders and subtract refunds", () => {
  const total = (tierService as any).calculateTierNetSales;
  assert.equal(total([{ status: "completed", grandTotal: 100, refundedAmount: 30 }, { status: "confirmed", grandTotal: 50, refundedAmount: 0 }, { status: "cancelled", grandTotal: 999, refundedAmount: 0 }]), 120);
});

test("tier job and history models enforce retry-safe source keys", async () => {
  const job = (await import("../models/retail-customer-tier-job.model") as any).RetailCustomerTierJobModel;
  const history = (await import("../models/retail-customer-tier-history.model") as any).RetailCustomerTierHistoryModel;
  assert.ok(job.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
  assert.ok(history.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.sourceKey === 1 && options.unique));
});
