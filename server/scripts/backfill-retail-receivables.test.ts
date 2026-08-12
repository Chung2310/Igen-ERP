import assert from "node:assert/strict";
import test from "node:test";
import * as backfill from "./backfill-retail-receivables";

test("backfill defaults to dry-run and only --apply enables writes", () => {
  const options = (backfill as any).parseBackfillOptions;
  assert.deepEqual(options([]), { apply: false });
  assert.deepEqual(options(["--dry-run"]), { apply: false });
  assert.deepEqual(options(["--apply"]), { apply: true });
});

test("backfill candidates use deterministic order keys", () => {
  const candidates = (backfill as any).buildReceivableBackfillCandidates;
  assert.deepEqual(candidates([{ _id: "o1", customerId: "c1", dueAmount: 75, status: "confirmed" }]), [{
    type: "charge", customerId: "c1", orderId: "o1", amount: 75, signedAmount: 75,
    idempotencyKey: "retail-order:o1:debt-charge",
  }]);
  assert.deepEqual(candidates([{ _id: "o2", dueAmount: 0, status: "completed" }, { _id: "o3", customerId: "c3", dueAmount: 10, status: "cancelled" }]), []);
});
