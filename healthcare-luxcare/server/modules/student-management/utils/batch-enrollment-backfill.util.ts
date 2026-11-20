export interface BatchEnrollmentBackfillCandidate {
  learnerIds: string[];
}

export interface BatchEnrollmentBackfillSummary {
  batches: number;
  learners: number;
}

/** Runs an idempotent enrollment backfill for each batch supplied by a migration. */
export async function runBatchEnrollmentBackfill<T extends BatchEnrollmentBackfillCandidate>(
  batches: AsyncIterable<T> | Iterable<T>,
  backfillBatch: (batch: T) => Promise<void>,
): Promise<BatchEnrollmentBackfillSummary> {
  let batchCount = 0;
  let learnerCount = 0;

  for await (const batch of batches) {
    await backfillBatch(batch);
    batchCount += 1;
    learnerCount += batch.learnerIds.length;
  }

  return { batches: batchCount, learners: learnerCount };
}
