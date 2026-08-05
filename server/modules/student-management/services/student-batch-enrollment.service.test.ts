import assert from "node:assert/strict";
import test from "node:test";
import { getPlannedSessionCount } from "./student-batch-enrollment.service";

test("planned session count follows the configured teaching weekdays", () => {
  assert.equal(getPlannedSessionCount({
    startDate: "2026-08-03",
    endDate: "2026-08-16",
    daysOfWeek: [1, 3, 5],
  }), 6);
});

test("planned session count refuses malformed schedules", () => {
  assert.equal(getPlannedSessionCount({ startDate: "", endDate: "2026-08-16", daysOfWeek: [1] }), 0);
  assert.equal(getPlannedSessionCount({ startDate: "2026-08-03", endDate: "2026-08-16", daysOfWeek: [] }), 0);
});
