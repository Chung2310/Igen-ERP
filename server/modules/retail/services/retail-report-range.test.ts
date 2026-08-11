import assert from "node:assert/strict";
import test from "node:test";
import { parseRetailReportRange } from "./retail-report-range";

test("defaults to today and expands the 7d and 30d presets inclusively", () => {
  assert.deepEqual(parseRetailReportRange({}, "2026-08-10"), {
    from: "2026-08-10",
    to: "2026-08-10",
    days: ["2026-08-10"],
  });
  assert.equal(parseRetailReportRange({ preset: "7d" }, "2026-08-10").from, "2026-08-04");
  assert.equal(parseRetailReportRange({ preset: "30d" }, "2026-08-10").from, "2026-07-12");
  assert.equal(parseRetailReportRange({ preset: "30d" }, "2026-08-10").days.length, 30);
});

test("uses UTC arithmetic and includes both range endpoints", () => {
  assert.deepEqual(parseRetailReportRange({ from: "2024-02-28", to: "2024-03-01" }), {
    from: "2024-02-28",
    to: "2024-03-01",
    days: ["2024-02-28", "2024-02-29", "2024-03-01"],
  });
});

test("uses the Vietnam business date when today is omitted", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-08-10T17:30:00.000Z") });

  assert.deepEqual(parseRetailReportRange({}), {
    from: "2026-08-11",
    to: "2026-08-11",
    days: ["2026-08-11"],
  });
});

test("rejects invalid YYYY-MM-DD dates, reversed dates, and ranges over 366 days", () => {
  const isBadRequest = (error: unknown) => (error as { status?: number }).status === 400;

  assert.throws(() => parseRetailReportRange({ from: "2026-2-10", to: "2026-08-10" }), isBadRequest);
  assert.throws(() => parseRetailReportRange({ from: "2026-08-10", to: "2026-08-09" }), isBadRequest);
  assert.throws(() => parseRetailReportRange({ from: "2025-08-09", to: "2026-08-10" }), isBadRequest);
});
