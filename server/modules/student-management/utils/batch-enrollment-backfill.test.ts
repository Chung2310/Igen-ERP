import assert from "node:assert/strict";
import { it } from "vitest";
import { runBatchEnrollmentBackfill } from "./batch-enrollment-backfill.util";

it("backfills every legacy batch and reports the processed totals", async () => {
  const processed: string[] = [];
  const batches = [
    { _id: "batch-1", learnerIds: ["student-1", "student-2"] },
    { _id: "batch-2", learnerIds: ["student-3"] },
  ];

  const summary = await runBatchEnrollmentBackfill(batches, async (batch) => {
    processed.push(batch._id);
  });

  assert.deepEqual(processed, ["batch-1", "batch-2"]);
  assert.deepEqual(summary, { batches: 2, learners: 3 });
});
