import assert from "node:assert/strict";
import test from "node:test";
import { ReminderDeliveryModel } from "../models/reminder-delivery.model";
import { ReminderRunModel } from "../models/reminder-run.model";
import { businessDateInTimeZone, createOverdueReminderService, isReceivableReminderEligible, nextReminderRetryAt, reminderCycleKey, reminderRetryDecision, retryReminderDeliveryWith } from "./overdue-reminder.service";
import { shouldRunOverdueSchedule } from "../jobs/overdue-scan.job";

const scope = { companyCode: "ACME", branchId: "B1" };
const now = new Date("2026-08-12T01:30:00.000Z"); // 08:30 Asia/Ho_Chi_Minh
const receivable = { _id: "r1", status: "open", balance: 100, dueDate: new Date("2026-08-10T17:00:00.000Z"), customerId: "c1", sourceCode: "DH1", reminderCount: 0 };

test("eligibility uses business-day boundaries and excludes terminal, suspended, and recent reminders", () => {
  assert.equal(businessDateInTimeZone(now, "Asia/Ho_Chi_Minh"), "2026-08-12");
  assert.equal(isReceivableReminderEligible(receivable, now, { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3 }), true);
  assert.equal(isReceivableReminderEligible({ ...receivable, dueDate: new Date("2026-08-11T17:00:00.000Z") }, now, { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3 }), false);
  for (const status of ["settled", "void", "written_off"]) assert.equal(isReceivableReminderEligible({ ...receivable, status }, now, { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3 }), false);
  assert.equal(isReceivableReminderEligible({ ...receivable, reminderSuspendedUntil: new Date("2026-08-13") }, now, { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3 }), false);
  assert.equal(isReceivableReminderEligible({ ...receivable, lastReminderAt: new Date("2026-08-11") }, now, { timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3 }), false);
});

test("cycle keys are stable per scope, day, receivable, and channel", () => {
  assert.equal(reminderCycleKey(scope, "2026-08-12", "r1", "in_app"), "ACME:B1:2026-08-12:r1:in_app");
  assert.notEqual(reminderCycleKey(scope, "2026-08-12", "r1", "marketing"), reminderCycleKey(scope, "2026-08-12", "r1", "in_app"));
});

function memoryDependencies(options: { marketing?: boolean; failNotification?: boolean; failPublish?: boolean } = {}) {
  const deliveries: any[] = [], updates: any[] = [], notifications: any[] = [], events: any[] = [];
  const service = createOverdueReminderService({
    settings: async () => ({ timeZone: "Asia/Ho_Chi_Minh", reminderIntervalDays: 3, maxAttempts: 5 }),
    findCandidates: async () => [structuredClone(receivable)],
    createRun: async (values) => ({ _id: "run1", ...values }),
    completeRun: async () => undefined,
    createDelivery: async (values) => { if (deliveries.some((item) => item.cycleKey === values.cycleKey)) return null; const item = { _id: `d${deliveries.length + 1}`, ...values }; deliveries.push(item); return item; },
    updateDelivery: async (id, values) => { Object.assign(deliveries.find((item) => item._id === id), values); },
    createNotification: async (payload) => { if (options.failNotification) throw new Error("notification failed"); notifications.push(payload); },
    marketingEnabled: async () => options.marketing ?? true,
    publishOverdue: async (event) => { if (options.failPublish) throw new Error("publish failed"); events.push(event); },
    updateReminderCache: async (...args) => { updates.push(args); },
  });
  return { service, deliveries, updates, notifications, events };
}

test("scan always queues in-app, publishes Marketing when enabled, and advances cache after enqueue", async () => {
  const memory = memoryDependencies();
  const result = await memory.service.runOverdueScan(scope, "manual", { id: "u1" }, now);
  assert.deepEqual(result, { eligible: 1, queued: 2, skipped: 0, failed: 0, duplicates: 0 });
  assert.equal(memory.notifications.length, 1); assert.equal(memory.events.length, 1); assert.equal(memory.updates.length, 1);
  assert.deepEqual(memory.deliveries.map((item) => [item.channel, item.status]), [["in_app", "queued"], ["marketing", "queued"]]);
});

test("Marketing disabled is skipped while in-app still succeeds", async () => {
  const memory = memoryDependencies({ marketing: false });
  const result = await memory.service.runOverdueScan(scope, "scheduled", undefined, now);
  assert.deepEqual(result, { eligible: 1, queued: 1, skipped: 1, failed: 0, duplicates: 0 });
  assert.equal(memory.notifications.length, 1); assert.equal(memory.events.length, 0); assert.equal(memory.updates.length, 1);
  assert.equal(memory.deliveries.find((item) => item.channel === "marketing").status, "skipped");
});

test("enqueue failure does not advance reminder cache and duplicate cycle suppresses resend", async () => {
  const failed = memoryDependencies({ failNotification: true, failPublish: true });
  const result = await failed.service.runOverdueScan(scope, "manual", undefined, now);
  assert.equal(result.failed, 2); assert.equal(failed.updates.length, 0);
  const replay = memoryDependencies();
  await replay.service.runOverdueScan(scope, "manual", undefined, now);
  const second = await replay.service.runOverdueScan(scope, "manual", undefined, now);
  assert.equal(second.duplicates, 2); assert.equal(replay.notifications.length, 1); assert.equal(replay.events.length, 1);
});

test("run and delivery models enforce cycle idempotency and retry indexes", () => {
  assert.equal((ReminderDeliveryModel.schema.path("status") as any).enumValues.includes("sending"), true);
  assert.ok(ReminderRunModel.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.branchId === 1 && keys.cycleKey === 1 && options.unique));
  assert.ok(ReminderDeliveryModel.schema.indexes().some(([keys, options]: any[]) => keys.cycleKey === 1 && options.unique));
  assert.ok(ReminderDeliveryModel.schema.indexes().some(([keys]: any[]) => keys.status === 1 && keys.nextAttemptAt === 1));
});

test("temporary delivery retries with bounded backoff while permanent and exhausted failures stop", () => {
  assert.deepEqual(reminderRetryDecision("temporary", 1, 5), { retry: true });
  assert.deepEqual(reminderRetryDecision("temporary", 5, 5), { retry: false });
  assert.deepEqual(reminderRetryDecision("permanent", 1, 5), { retry: false });
  assert.equal(nextReminderRetryAt(1, now).toISOString(), "2026-08-12T01:31:00.000Z");
  assert.equal(nextReminderRetryAt(5, now).toISOString(), "2026-08-12T07:30:00.000Z");
});

test("scheduler runs once at or after 08:15 business time", () => {
  assert.equal(shouldRunOverdueSchedule(new Date("2026-08-12T01:14:59.000Z"), "Asia/Ho_Chi_Minh", undefined), false);
  assert.equal(shouldRunOverdueSchedule(new Date("2026-08-12T01:15:00.000Z"), "Asia/Ho_Chi_Minh", undefined), true);
  assert.equal(shouldRunOverdueSchedule(new Date("2026-08-12T02:00:00.000Z"), "Asia/Ho_Chi_Minh", "2026-08-12"), false);
});

test("manual retry sends a temporary failed delivery and persists sent state", async () => {
  const updates: any[] = [], sends: any[] = [];
  const delivery = { _id: "d1", status: "failed", failureType: "temporary", attempt: 1, maxAttempts: 5, channel: "marketing", payload: { receivableId: "r1" } };
  const result = await retryReminderDeliveryWith("d1", now, {
    claim: async () => ({ ...delivery, attempt: 2 }), send: async (item) => { sends.push(item); }, update: async (...args) => { updates.push(args); },
  });
  assert.equal(result.status, "sent"); assert.equal(sends.length, 1);
  assert.deepEqual(updates[0][1], { status: "sent", sentAt: now, failureType: undefined, error: undefined, nextAttemptAt: undefined });
  await assert.rejects(() => retryReminderDeliveryWith("d2", now, { claim: async () => null, send: async () => undefined, update: async () => undefined }), /DELIVERY_NOT_RETRYABLE/);
});
