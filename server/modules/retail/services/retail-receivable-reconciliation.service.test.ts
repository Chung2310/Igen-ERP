import assert from "node:assert/strict";
import test from "node:test";
import * as reconciliation from "./retail-receivable-reconciliation.service";

test("reconciliation reports order and ledger differences without mutation instructions", () => {
  const compare = (reconciliation as any).compareRetailReceivableBalances;
  assert.equal(typeof compare, "function");
  const result = compare(
    [{ orderId: "o1", snapshotDue: 70 }, { orderId: "o2", snapshotDue: 20 }],
    [{ orderId: "o1", ledgerDue: 50 }, { orderId: "o3", ledgerDue: 10 }],
  );
  assert.deepEqual(result, [
    { orderId: "o1", snapshotDue: 70, ledgerDue: 50, difference: 20 },
    { orderId: "o2", snapshotDue: 20, ledgerDue: 0, difference: 20 },
    { orderId: "o3", snapshotDue: 0, ledgerDue: 10, difference: -10 },
  ]);
  assert.equal(JSON.stringify(result).includes("update"), false);
});

test("reconciliation scope is mandatory", () => {
  const validate = (reconciliation as any).validateReconciliationScope;
  assert.throws(() => validate({ companyCode: "ACME", branchId: "" }));
});
