import assert from "node:assert/strict";
import test from "node:test";
import { normalizeError } from "../../../errors/normalize-error";
import { assertRetailShiftOperational, buildRetailShiftScheduleSnapshot, calculateExpectedCash, isRetailShiftOperational, missingVarianceReasonError, resolveRetailShiftSchedule, retailShiftOperationalEndsAt, serializeCashierShift, varianceNeedsReason } from "./cashier-shift.service";

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

test("missing variance reason is a public validation error", () => {
  const normalized = normalizeError(missingVarianceReasonError());
  assert.equal(normalized.status, 400);
  assert.equal(normalized.code, "SHIFT_VARIANCE_REASON_REQUIRED");
  assert.equal(normalized.message, "Vui lòng nhập lý do chênh lệch ca.");
});

test("daytime retail shifts remain operational until Vietnam day-end", () => {
  const deadline = retailShiftOperationalEndsAt({
    businessDate: "2026-08-13",
    scheduledEndAt: new Date("2026-08-13T10:30:00.000Z"),
    crossesMidnight: false,
  });
  assert.equal(deadline.toISOString(), "2026-08-13T16:59:59.999Z");
  assert.equal(isRetailShiftOperational({ operationalEndsAt: deadline }, new Date("2026-08-13T16:59:59.999Z")), true);
  assert.equal(isRetailShiftOperational({ operationalEndsAt: deadline }, new Date("2026-08-13T17:00:00.000Z")), false);
});

test("cross-midnight retail shifts expire at their scheduled employee end", () => {
  const scheduledEndAt = new Date("2026-08-13T23:00:00.000Z");
  assert.equal(retailShiftOperationalEndsAt({ businessDate: "2026-08-13", scheduledEndAt, crossesMidnight: true }), scheduledEndAt);
});

test("legacy shifts without a snapshot expire at the end of their recorded business date", () => {
  assert.equal(isRetailShiftOperational({ businessDate: "2026-08-13" }, new Date("2026-08-13T16:59:59.999Z")), true);
  assert.equal(isRetailShiftOperational({ businessDate: "2026-08-13" }, new Date("2026-08-13T17:00:00.000Z")), false);
});

test("opening snapshots an assigned daytime work schedule", () => {
  const snapshot = buildRetailShiftScheduleSnapshot({
    shift: { _id: "work-1", code: "HC", name: "HÃ nh chÃ­nh", startTime: "08:00", endTime: "17:00", crossesMidnight: false, workingDays: [1, 2, 3, 4, 5] },
  } as any, "2026-08-13", new Date("2026-08-13T03:00:00.000Z"));
  assert.deepEqual(snapshot, {
    workShiftId: "work-1", workShiftCode: "HC", workShiftName: "HÃ nh chÃ­nh",
    scheduledStartAt: new Date("2026-08-13T01:00:00.000Z"),
    scheduledEndAt: new Date("2026-08-13T10:00:00.000Z"),
    operationalEndsAt: new Date("2026-08-13T16:59:59.999Z"),
  });
});

test("opening rejects times outside the assigned work window and non-working days", () => {
  const resolved = { shift: { code: "HC", name: "HÃ nh chÃ­nh", startTime: "08:00", endTime: "17:00", crossesMidnight: false, workingDays: [1, 2, 3, 4, 5] } } as any;
  const outsideSchedule = (error: unknown) => (error as any).code === "OUTSIDE_WORK_SCHEDULE" && (error as any).status === 409;
  assert.throws(() => buildRetailShiftScheduleSnapshot(resolved, "2026-08-13", new Date("2026-08-13T00:59:59.999Z")), outsideSchedule);
  assert.throws(() => buildRetailShiftScheduleSnapshot(resolved, "2026-08-13", new Date("2026-08-13T10:00:00.001Z")), outsideSchedule);
  assert.throws(() => buildRetailShiftScheduleSnapshot(resolved, "2026-08-16", new Date("2026-08-16T03:00:00.000Z")), outsideSchedule);
});

test("cross-midnight schedules snapshot the next-day employee end as operational deadline", () => {
  const snapshot = buildRetailShiftScheduleSnapshot({ shift: { code: "DEM", name: "Ca Ä‘Ãªm", startTime: "22:00", endTime: "06:00", crossesMidnight: true, workingDays: [4] } } as any, "2026-08-13", new Date("2026-08-13T16:00:00.000Z"));
  assert.equal(snapshot.scheduledEndAt.toISOString(), "2026-08-13T23:00:00.000Z");
  assert.equal(snapshot.operationalEndsAt.toISOString(), "2026-08-13T23:00:00.000Z");
});

test("operational authorization distinguishes missing and expired open shifts", () => {
  assert.throws(() => assertRetailShiftOperational(null), (error: any) => error.code === "SHIFT_NOT_OPEN" && error.status === 409);
  assert.throws(
    () => assertRetailShiftOperational({ businessDate: "2026-08-13", status: "open" } as any, new Date("2026-08-13T17:00:00.000Z")),
    (error: any) => error.code === "SHIFT_EXPIRED" && error.status === 409,
  );
  const shift = { businessDate: "2026-08-13", status: "open" } as any;
  assert.equal(assertRetailShiftOperational(shift, new Date("2026-08-13T16:00:00.000Z")), shift);
});

test("opening after midnight resolves the cross-midnight assignment from the previous work date", async () => {
  const dates: string[] = [];
  const result = await resolveRetailShiftSchedule("ACME", "employee-1", new Date("2026-08-13T18:00:00.000Z"), async (_company, _employee, workDate) => {
    dates.push(workDate);
    return { shift: { code: "DEM", name: "Ca Ä‘Ãªm", startTime: "22:00", endTime: "06:00", crossesMidnight: true, workingDays: [4] } } as any;
  });
  assert.deepEqual(dates, ["2026-08-14", "2026-08-13"]);
  assert.equal(result.businessDate, "2026-08-13");
  assert.equal(result.snapshot.operationalEndsAt.toISOString(), "2026-08-13T23:00:00.000Z");
});
