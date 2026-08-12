import assert from "node:assert/strict";
import test from "node:test";
import { calculateExpectedCash, serializeCashierShift, varianceNeedsReason } from "./cashier-shift.service";

test("expected cash uses actual cash flows only", () => {
  assert.equal(calculateExpectedCash({ openingFloat: 500_000, cashCollected: 1_200_000, cashRefunded: 100_000, movementsIn: 50_000, movementsOut: 200_000 }), 1_450_000);
});

test("blind count hides expected and revenue-derived values while open", () => {
  const serialized = serializeCashierShift({
    status: "open", countedCash: undefined, expectedCash: 1_450_000,
    grossSales: 2_000_000, collectedAmount: 1_500_000,
    methodTotals: [{ method: "cash", collectedAmount: 1_200_000, refundedAmount: 100_000 }],
  } as any, false) as any;
  assert.equal("expectedCash" in serialized, false);
  assert.equal("grossSales" in serialized, false);
  assert.deepEqual(serialized.methodTotals, [{ method: "cash" }]);
});

test("manager or submitted count can see expected values", () => {
  const shift = { status: "open", countedCash: undefined, expectedCash: 10 } as any;
  assert.equal((serializeCashierShift(shift, true) as any).expectedCash, 10);
  assert.equal((serializeCashierShift({ ...shift, countedCash: 9 }, false) as any).expectedCash, 10);
});

test("variance reason threshold is strict greater-than and defaults to zero", () => {
  assert.equal(varianceNeedsReason(0, 0), false);
  assert.equal(varianceNeedsReason(-1, 0), true);
  assert.equal(varianceNeedsReason(100, 100), false);
  assert.equal(varianceNeedsReason(101, 100), true);
});
