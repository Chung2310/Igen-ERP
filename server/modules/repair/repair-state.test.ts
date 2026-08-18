import assert from "node:assert/strict";
import test from "node:test";
import { assertRepairTransition, pausesSla } from "./repair-state";

test("repair accepts supplier waiting state and resumes repair", () => {
  assert.doesNotThrow(() => assertRepairTransition("repairing", "waiting_supplier"));
  assert.doesNotThrow(() => assertRepairTransition("waiting_supplier", "repairing"));
  assert.equal(pausesSla("waiting_supplier"), true);
});

test("repair rejects delivering an unfinished ticket", () => {
  assert.throws(() => assertRepairTransition("repairing", "delivered"), /Invalid repair transition/);
});
