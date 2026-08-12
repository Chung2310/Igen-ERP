import assert from "node:assert/strict";
import test from "node:test";
import { mapLegacyReceivable, parseFinanceBackfillOptions, runFinanceReceivableBackfill } from "./backfill-finance-receivables";

const order = { _id: "o1", companyCode: "ACME", branchId: "B1", orderCode: "DH1", customerId: "c1", customerName: "Khách", dueAmount: 70, dueDate: new Date("2026-08-20T00:00:00.000Z"), confirmedAt: new Date("2026-08-01T00:00:00.000Z") };
const entries = [
  { _id: "e1", type: "charge", signedAmount: 100, createdAt: new Date("2026-08-01T00:00:00.000Z"), createdBy: "u1", createdByName: "A" },
  { _id: "e2", type: "payment", signedAmount: -30, createdAt: new Date("2026-08-02T00:00:00.000Z"), createdBy: "u1", createdByName: "A" },
];

test("CLI parses separated scope and dry-run/apply/reconcile modes", () => {
  assert.deepEqual(parseFinanceBackfillOptions(["--dry-run", "--company", "ACME", "--branch", "B1"]), { mode: "dry-run", companyCode: "ACME", branchId: "B1" });
  assert.deepEqual(parseFinanceBackfillOptions(["--apply", "--company=ACME", "--branch=B1"]), { mode: "apply", companyCode: "ACME", branchId: "B1" });
  assert.deepEqual(parseFinanceBackfillOptions(["--reconcile", "--company", "ACME", "--branch", "B1"]), { mode: "reconcile", companyCode: "ACME", branchId: "B1" });
});

test("legacy mapping produces stable source and entry keys", () => {
  const candidate = mapLegacyReceivable(order, entries);
  assert.equal(candidate.sourceEventId, "legacy:retail-order:o1");
  assert.equal(candidate.receivableCode, "CN-LEGACY-DH1");
  assert.deepEqual(candidate.entries.map((entry: any) => entry.idempotencyKey), ["legacy:retail-entry:e1", "legacy:retail-entry:e2"]);
  assert.equal(candidate.balance, 70);
});

test("dry-run reports convertible data with zero writes and apply skips replay", async () => {
  let writes = 0;
  const dependencies = {
    scan: async () => [{ order, entries }], exists: async () => false,
    apply: async () => { writes += 1; }, reconcile: async () => ({ mismatches: [] }),
  };
  assert.deepEqual(await runFinanceReceivableBackfill({ mode: "dry-run", companyCode: "ACME", branchId: "B1" }, dependencies), { scanned: 1, convertible: 1, created: 0, skipped: 0, errors: [], writes: 0 });
  assert.equal(writes, 0);
  assert.equal((await runFinanceReceivableBackfill({ mode: "apply", companyCode: "ACME", branchId: "B1" }, dependencies)).created, 1);
  assert.equal(writes, 1);
  const replay = await runFinanceReceivableBackfill({ mode: "apply", companyCode: "ACME", branchId: "B1" }, { ...dependencies, exists: async () => true });
  assert.equal(replay.skipped, 1); assert.equal(writes, 1);
});

test("malformed or mismatched legacy debt is reported and never auto-repaired", async () => {
  let writes = 0;
  const result = await runFinanceReceivableBackfill({ mode: "apply", companyCode: "ACME", branchId: "B1" }, {
    scan: async () => [{ order: { ...order, customerId: "" }, entries }, { order, entries: [{ ...entries[0], signedAmount: 99 }] }],
    exists: async () => false, apply: async () => { writes += 1; }, reconcile: async () => ({ mismatches: [] }),
  });
  assert.equal(result.scanned, 2); assert.equal(result.convertible, 0); assert.equal(result.errors.length, 2); assert.equal(writes, 0);
});
