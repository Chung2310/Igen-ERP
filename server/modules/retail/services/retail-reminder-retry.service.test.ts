import assert from "node:assert/strict";
import test from "node:test";
import { nextReminderAttemptAt, reminderRetryDecision } from "./retail-reminder-retry.service";

test("retry backoff is deterministic and exponentially bounded", () => {
  const now = new Date("2026-08-12T00:00:00Z");
  assert.equal(nextReminderAttemptAt(1, now).toISOString(), "2026-08-12T00:05:00.000Z");
  assert.equal(nextReminderAttemptAt(2, now).toISOString(), "2026-08-12T00:10:00.000Z");
  assert.equal(nextReminderAttemptAt(10, now).toISOString(), "2026-08-13T00:00:00.000Z");
});

test("temporary errors retry below max attempts but permanent errors never retry", () => {
  assert.deepEqual(reminderRetryDecision("temporary", 2, 3), { retry: true });
  assert.deepEqual(reminderRetryDecision("temporary", 3, 3), { retry: false });
  assert.deepEqual(reminderRetryDecision("permanent", 1, 3), { retry: false });
});
