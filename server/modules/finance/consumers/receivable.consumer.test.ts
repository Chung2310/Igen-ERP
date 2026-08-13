import assert from "node:assert/strict";
import test from "node:test";
import { clearDomainConsumersForTests, getDomainConsumer } from "../../../integrations/shared/event-bus";
import { createReceivableConsumer, publishReceivableSettled, registerFinanceReceivableConsumers } from "./receivable.consumer";

const envelope = (eventType: string, payload: any, eventId = "evt-1") => ({
  eventId, eventType, companyCode: "ACME", branchId: "B1", occurredAt: new Date("2026-08-12T00:00:00.000Z"),
  actorId: "u1", actorName: "Thu ngân", payload,
});

test("confirmed paid-in-full is skipped while debt requires customer and due date", async () => {
  const calls: any[] = [];
  const consumer = createReceivableConsumer({
    openFromEvent: async (...args: any[]) => { calls.push(args); }, settleFromEvent: async () => undefined, voidFromEvent: async () => undefined,
  });
  assert.deepEqual(await consumer.confirmed(envelope("retail.order.confirmed", { orderId: "o1", orderCode: "DH1", branchId: "B1", grandTotal: 100, paidAmount: 100, dueAmount: 0 })), { skipped: true });
  await assert.rejects(() => consumer.confirmed(envelope("retail.order.confirmed", { orderId: "o2", orderCode: "DH2", branchId: "B1", dueAmount: 10, customerId: "", dueDate: "" })), /CUSTOMER_REQUIRED/);
  assert.equal(calls.length, 0);
});

test("confirmed debt maps the event snapshot and replay-stable source id", async () => {
  const calls: any[] = [];
  const consumer = createReceivableConsumer({
    openFromEvent: async (...args: any[]) => { calls.push(args); return { _id: "r1" }; }, settleFromEvent: async () => undefined, voidFromEvent: async () => undefined,
  });
  const event = envelope("retail.order.confirmed", {
    orderId: "o1", orderCode: "DH1", branchId: "B1", customerId: "c1", customerName: "Khách", dueAmount: 60,
    dueDate: "2026-08-20T00:00:00.000Z", grandTotal: 100, paidAmount: 40,
  });
  await consumer.confirmed(event); await consumer.confirmed(event);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [
    { companyCode: "ACME", branchId: "B1" },
    { receivableCode: "CN-DH1", sourceType: "retail_order", sourceId: "o1", sourceCode: "DH1", sourceEventId: "evt-1", customerId: "c1", customerName: "Khách", originalAmount: 60, occurredAt: event.occurredAt, dueDate: new Date("2026-08-20T00:00:00.000Z") },
    { id: "u1", name: "Thu ngân" },
  ]);
  assert.equal(calls[1][1].sourceEventId, "evt-1");
});

test("paid and cancelled events become idempotent ledger commands", async () => {
  const calls: any[] = [];
  const consumer = createReceivableConsumer({
    openFromEvent: async () => undefined,
    settleFromEvent: async (...args: any[]) => { calls.push(["paid", ...args]); },
    voidFromEvent: async (...args: any[]) => { calls.push(["cancel", ...args]); },
  });
  await consumer.paid(envelope("retail.order.paid", { orderId: "o1", orderCode: "DH1", branchId: "B1", customerId: "c1", amount: 40, transactionKey: "tx1", occurredAt: "2026-08-12T01:00:00.000Z" }, "evt-paid"));
  await consumer.cancelled(envelope("retail.order.cancelled", { orderId: "o1", orderCode: "DH1", branchId: "B1", customerId: "c1", dueAmount: 60, refundedAmount: 40, reason: "Hủy", cancelledAt: "2026-08-12T02:00:00.000Z" }, "evt-cancel"));
  assert.deepEqual(calls[0], ["paid", { companyCode: "ACME", branchId: "B1" }, "retail_order", "o1", { amount: 40, idempotencyKey: "event:evt-paid", paymentMethod: "retail", reference: "tx1" }, { id: "u1", name: "Thu ngân" }]);
  assert.deepEqual(calls[1], ["cancel", { companyCode: "ACME", branchId: "B1" }, "retail_order", "o1", { remainingDebt: 60, refundedAmount: 40, reason: "Hủy", idempotencyKey: "event:evt-cancel" }, { id: "u1", name: "Thu ngân" }]);
});

test("cancelled order without remaining debt does not require a Finance receivable", async () => {
  let voidCalls = 0;
  const consumer = createReceivableConsumer({
    openFromEvent: async () => undefined, settleFromEvent: async () => undefined,
    voidFromEvent: async () => { voidCalls += 1; },
  });
  assert.deepEqual(await consumer.cancelled(envelope("retail.order.cancelled", { orderId: "o-paid", branchId: "B1", dueAmount: 0, refundedAmount: 100, reason: "Hủy", cancelledAt: "2026-08-12T02:00:00.000Z" })), { skipped: true });
  assert.equal(voidCalls, 0);
});

test("Finance consumers register once with module guard", () => {
  clearDomainConsumersForTests();
  registerFinanceReceivableConsumers({ openFromEvent: async () => undefined, settleFromEvent: async () => undefined, voidFromEvent: async () => undefined });
  for (const [type, name] of [["retail.order.confirmed", "finance.receivable-open"], ["retail.order.paid", "finance.receivable-paid"], ["retail.order.cancelled", "finance.receivable-cancelled"]]) {
    assert.equal(getDomainConsumer(type as any, name)?.requiresModule, "finance");
  }
  assert.doesNotThrow(() => registerFinanceReceivableConsumers({ openFromEvent: async () => undefined, settleFromEvent: async () => undefined, voidFromEvent: async () => undefined }));
});

test("settled publisher emits a stable event without importing Retail", async () => {
  const calls: any[] = [];
  const settledAt = new Date("2026-08-12T06:00:00.000Z");
  await publishReceivableSettled({ _id: "r1", companyCode: "ACME", branchId: "B1", sourceType: "retail_order", sourceId: "o1", sourceCode: "DH1", updatedAt: settledAt }, async (event: any) => { calls.push(event); });
  assert.deepEqual(calls[0], {
    eventId: "finance-receivable:r1:settled", eventType: "finance.receivable.settled", companyCode: "ACME", branchId: "B1",
    aggregateType: "FinanceReceivable", aggregateId: "r1", occurredAt: settledAt, actorId: "system", actorName: "Finance",
    payload: { receivableId: "r1", sourceType: "retail_order", sourceId: "o1", sourceCode: "DH1", settledAt: settledAt.toISOString() },
  });
});
