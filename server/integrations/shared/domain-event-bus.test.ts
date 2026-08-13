import assert from "node:assert/strict";
import test from "node:test";
import { domainRetryDelay } from "./retry-policy";
import {
  clearDomainConsumersForTests,
  getDomainConsumer,
  publishDomainEvent,
  registerDomainConsumer,
} from "./event-bus";
import { dispatchDomainDelivery } from "./event-dispatcher";

test("domain retry policy follows the bounded finance backoff", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(domainRetryDelay), [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 21_600_000]);
});

test("consumer names are unique and registration is inspectable", () => {
  clearDomainConsumersForTests();
  const handler = async () => undefined;
  registerDomainConsumer("retail.order.confirmed", "finance.receivable-open", handler, { requiresModule: "finance" });
  assert.equal(getDomainConsumer("retail.order.confirmed", "finance.receivable-open")?.handler, handler);
  assert.throws(() => registerDomainConsumer("retail.order.confirmed", "finance.receivable-open", handler), /đã được đăng ký/i);
});

test("publish persists a snapshot and forwards the transaction session", async () => {
  const calls: any[] = [];
  const session = { id: "session-1" } as any;
  await publishDomainEvent({
    eventId: "evt-1", eventType: "retail.order.confirmed", companyCode: "ACME", branchId: "B1",
    aggregateType: "RetailOrder", aggregateId: "o1", occurredAt: new Date("2026-08-12T00:00:00Z"),
    actorId: "u1", actorName: "An", payload: { orderId: "o1", orderCode: "DH1", branchId: "B1", customerId: "c1", customerName: "A", grandTotal: 100, paidAmount: 40, dueAmount: 60, dueDate: "2026-08-20" },
  }, session, { create: async (rows: any[], options: any) => { calls.push({ rows, options }); } } as any);
  assert.equal(calls[0].rows[0].eventId, "evt-1");
  assert.deepEqual(calls[0].rows[0].payload, { orderId: "o1", orderCode: "DH1", branchId: "B1", customerId: "c1", customerName: "A", grandTotal: 100, paidAmount: 40, dueAmount: 60, dueDate: "2026-08-20" });
  assert.equal(calls[0].options.session, session);
});

test("dispatcher marks unregistered and disabled consumers skipped", async () => {
  clearDomainConsumersForTests();
  assert.deepEqual(await dispatchDomainDelivery({ eventType: "retail.order.confirmed" } as any, "missing", { moduleEnabled: async () => true }), { status: "skipped", attempts: 0 });
  registerDomainConsumer("retail.order.confirmed", "finance.receivable-open", async () => undefined, { requiresModule: "finance" });
  assert.deepEqual(await dispatchDomainDelivery({ eventType: "retail.order.confirmed" } as any, "finance.receivable-open", { moduleEnabled: async () => false }), { status: "skipped", attempts: 0 });
});

test("dispatcher completes successes and schedules bounded failures", async () => {
  clearDomainConsumersForTests();
  registerDomainConsumer("retail.order.confirmed", "ok", async () => undefined);
  const done = await dispatchDomainDelivery({ eventType: "retail.order.confirmed" } as any, "ok", { moduleEnabled: async () => true });
  assert.equal(done.status, "done"); assert.equal(done.attempts, 1); assert.ok(done.completedAt instanceof Date);
  registerDomainConsumer("retail.order.confirmed", "bad", async () => { throw new Error("network"); });
  const retry = await dispatchDomainDelivery({ eventType: "retail.order.confirmed" } as any, "bad", { moduleEnabled: async () => true, previousAttempts: 3, now: new Date("2026-08-12T00:00:00Z") });
  assert.equal(retry.status, "pending"); assert.equal(retry.attempts, 4); assert.equal(retry.nextAttemptAt?.toISOString(), "2026-08-12T01:00:00.000Z");
  const failed = await dispatchDomainDelivery({ eventType: "retail.order.confirmed" } as any, "bad", { moduleEnabled: async () => true, previousAttempts: 4 });
  assert.equal(failed.status, "failed"); assert.equal(failed.attempts, 5);
});
