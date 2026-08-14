import assert from "node:assert/strict";
import test from "node:test";
import { buildDebtReminder, buildDebtReminderRecipientPlans, vietnamBusinessDate, buildReminderRunSnapshot, summarizeReminderDeliveries, classifyReminderFailure, reminderCycleKey, reminderDeliveryChannels } from "./retail-debt-reminder.service";
import { RetailDebtReminderRunModel } from "../models/retail-debt-reminder-run.model";
import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";

test("uses the Vietnam business date around UTC day boundaries", () => {
  assert.equal(vietnamBusinessDate(new Date("2026-08-10T18:30:00.000Z")), "2026-08-11");
});

test("builds a stable per-order daily idempotency key and Vietnamese reminder", () => {
  const reminder = buildDebtReminder({ _id: "order-1", orderCode: "ORD-001", customerName: "Nguyễn Văn A", dueAmount: 1250000, dueDate: new Date("2026-08-01T00:00:00.000Z") }, "2026-08-10");
  assert.equal(reminder.idempotencyKey, "retail-debt:order-1:2026-08-10");
  assert.match(reminder.title, /ORD-001/);
  assert.match(reminder.body, /1\.250\.000 ₫/);
});

test("run snapshot is immutable data for the selected cycle", () => {
  const settings: any = { enabled: true, frequencyHours: 6, overdueDays: 3, recipientUserIds: ["u1"], recipientRoles: ["manager"], emailEnabled: true, maxAttempts: 4 };
  const snapshot = buildReminderRunSnapshot(settings, "2026-08-10");
  settings.recipientUserIds.push("u2");
  assert.deepEqual(snapshot, { cycleKey: "2026-08-10/6", settings: { enabled: true, frequencyHours: 6, overdueDays: 3, recipientUserIds: ["u1"], recipientRoles: ["manager"], emailEnabled: true, maxAttempts: 4 } });
});

test("cycle key follows the configured Vietnam-hour frequency", () => {
  assert.equal(reminderCycleKey(new Date("2026-08-10T01:30:00Z"), 6), "2026-08-10/06");
  assert.equal(reminderCycleKey(new Date("2026-08-10T05:59:00Z"), 6), "2026-08-10/12");
});

test("delivery statistics distinguish queued sent failed and duplicate", () => {
  assert.deepEqual(summarizeReminderDeliveries(["queued", "sent", "sent", "failed", "duplicate"] as any), { total: 5, queued: 1, sent: 2, failed: 1, duplicates: 1 });
});

test("email delivery is queued only when enabled and recipient has email", () => {
  assert.deepEqual(reminderDeliveryChannels(true, "manager@example.com"), ["notification", "email"]);
  assert.deepEqual(reminderDeliveryChannels(true, ""), ["notification"]);
  assert.deepEqual(reminderDeliveryChannels(false, "manager@example.com"), ["notification"]);
});

test("reminder failures distinguish temporary and permanent delivery errors", () => {
  assert.equal(classifyReminderFailure({ responseCode: 421 }), "temporary");
  assert.equal(classifyReminderFailure({ code: "ETIMEDOUT" }), "temporary");
  assert.equal(classifyReminderFailure({ responseCode: 550 }), "permanent");
  assert.equal(classifyReminderFailure(new Error("SMTP chua duoc cau hinh")), "permanent");
});

test("run and delivery schemas enforce one cycle and one delivery per recipient channel", () => {
  assert.ok(RetailDebtReminderRunModel.schema.indexes().some(([keys, options]: any) => keys.companyCode === 1 && keys.branchId === 1 && keys.cycleKey === 1 && options.unique));
  assert.ok(RetailDebtReminderDeliveryModel.schema.indexes().some(([keys, options]: any) => keys.runId === 1 && keys.orderId === 1 && keys.recipientId === 1 && keys.channel === 1 && options.unique));
});

test("plans customer email plus creator notification and email for each overdue order", () => {
  const plans = buildDebtReminderRecipientPlans(
    { _id: "order-1", orderCode: "ORD-001", customerId: "customer-1", customerName: "Khách A", createdBy: "creator-1", dueAmount: 500000, dueDate: new Date("2026-08-01T00:00:00Z") },
    { _id: "customer-1", name: "Khách A", email: "customer@example.com" },
    { _id: "creator-1", displayName: "Nhân viên A", email: "creator@example.com" },
    "2026-08-10", true, 3,
  );
  assert.deepEqual(plans.map((item) => [item.recipientType, item.channel, item.status]), [
    ["customer", "email", "queued"], ["creator", "notification", "queued"], ["creator", "email", "queued"],
  ]);
  assert.equal(plans[0].payload.to, "customer@example.com");
  assert.equal(plans[2].payload.to, "creator@example.com");
});

test("missing legacy customer email does not prevent creator reminders", () => {
  const plans = buildDebtReminderRecipientPlans(
    { _id: "order-1", customerId: "customer-1", customerName: "Khách A", createdBy: "creator-1", dueAmount: 500000, dueDate: new Date("2026-08-01T00:00:00Z") },
    { _id: "customer-1", name: "Khách A", email: "" },
    { _id: "creator-1", displayName: "Nhân viên A", email: "creator@example.com" },
    "2026-08-10", true, 3,
  );
  assert.equal(plans[0].status, "failed");
  assert.equal(plans[0].failureType, "permanent");
  assert.equal(plans[0].error, "CUSTOMER_EMAIL_MISSING");
  assert.deepEqual(plans.slice(1).map((item) => item.status), ["queued", "queued"]);
});
