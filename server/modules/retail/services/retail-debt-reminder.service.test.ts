import assert from "node:assert/strict";
import test from "node:test";
import { buildDebtReminder, vietnamBusinessDate } from "./retail-debt-reminder.service";

test("uses the Vietnam business date around UTC day boundaries", () => {
  assert.equal(vietnamBusinessDate(new Date("2026-08-10T18:30:00.000Z")), "2026-08-11");
});

test("builds a stable per-order daily idempotency key and Vietnamese reminder", () => {
  const reminder = buildDebtReminder({ _id: "order-1", orderCode: "ORD-001", customerName: "Nguyễn Văn A", dueAmount: 1250000, dueDate: new Date("2026-08-01T00:00:00.000Z") }, "2026-08-10");
  assert.equal(reminder.idempotencyKey, "retail-debt:order-1:2026-08-10");
  assert.match(reminder.title, /ORD-001/);
  assert.match(reminder.body, /1\.250\.000 ₫/);
});
