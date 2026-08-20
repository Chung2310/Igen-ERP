import assert from "node:assert/strict";
import { test } from "vitest";
import { buildStraightLineSchedule } from "./depreciation";

test("straight-line schedule preserves the depreciable total in its final period", () => {
  const schedule = buildStraightLineSchedule({
    originalCost: 100_000,
    salvageValue: 10_000,
    inServiceDate: new Date("2026-01-15T00:00:00.000Z"),
    usefulLifeMonths: 3,
  });

  assert.deepEqual(schedule.map((item) => item.period), ["2026-01", "2026-02", "2026-03"]);
  assert.deepEqual(schedule.map((item) => item.amount), [30_000, 30_000, 30_000]);
  assert.equal(schedule.at(-1)?.accumulatedAfter, 90_000);
});

test("straight-line schedule assigns rounding residue to final period", () => {
  const schedule = buildStraightLineSchedule({
    originalCost: 100,
    salvageValue: 0,
    inServiceDate: new Date("2026-01-01T00:00:00.000Z"),
    usefulLifeMonths: 3,
  });

  assert.deepEqual(schedule.map((item) => item.amount), [33, 33, 34]);
  assert.equal(schedule.reduce((sum, item) => sum + item.amount, 0), 100);
});
