import assert from "node:assert/strict";
import test from "node:test";
import { publishRetailOrderEvent } from "./retail-order-events";

const scope = { companyCode: "ACME", branchId: "B1" };
const actor = { id: "u1", displayName: "Thu ngân A" };
const order = {
  _id: "o1", orderCode: "DH-1", customerId: "c1", customerName: "Khách A", customerPhone: "0901",
  grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, dueDate: new Date("2026-08-20T00:00:00.000Z"),
  confirmedAt: new Date("2026-08-12T02:00:00.000Z"), refundedAmount: 0,
};

test("confirmed debt event includes a complete historical snapshot and transaction session", async () => {
  const calls: any[] = [];
  const session = { id: "s1" } as any;
  await publishRetailOrderEvent("confirmed", scope, order, actor, { session, publish: async (...args: any[]) => { calls.push(args); } });
  const [event, forwardedSession] = calls[0];
  assert.equal(forwardedSession, session);
  assert.deepEqual(event, {
    eventId: "retail-order:o1:confirmed", eventType: "retail.order.confirmed", companyCode: "ACME", branchId: "B1",
    aggregateType: "RetailOrder", aggregateId: "o1", occurredAt: order.confirmedAt, actorId: "u1", actorName: "Thu ngân A",
    payload: {
      orderId: "o1", orderCode: "DH-1", branchId: "B1", customerId: "c1", customerName: "Khách A", customerPhone: "0901",
      grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, dueDate: "2026-08-20T00:00:00.000Z",
    },
  });
});

test("paid event has a stable transaction key and amount", async () => {
  const calls: any[] = [];
  await publishRetailOrderEvent("paid", scope, { ...order, dueAmount: 20_000 }, actor, {
    session: {} as any, amount: 40_000, transactionKey: "collect-1", occurredAt: new Date("2026-08-12T03:00:00.000Z"),
    publish: async (event: any) => { calls.push(event); },
  });
  assert.equal(calls[0].eventId, "retail-order:o1:paid:collect-1");
  assert.deepEqual(calls[0].payload, {
    orderId: "o1", orderCode: "DH-1", branchId: "B1", customerId: "c1", amount: 40_000,
    transactionKey: "collect-1", occurredAt: "2026-08-12T03:00:00.000Z",
  });
});

test("cancelled event carries remaining debt and refund snapshot", async () => {
  const calls: any[] = [];
  const cancelledAt = new Date("2026-08-12T04:00:00.000Z");
  await publishRetailOrderEvent("cancelled", scope, { ...order, dueAmount: 60_000, refundedAmount: 40_000, cancelReason: "Khách hủy", cancelledAt }, actor, {
    session: {} as any, publish: async (event: any) => { calls.push(event); },
  });
  assert.equal(calls[0].eventId, "retail-order:o1:cancelled");
  assert.deepEqual(calls[0].payload, {
    orderId: "o1", orderCode: "DH-1", branchId: "B1", customerId: "c1", dueAmount: 60_000,
    refundedAmount: 40_000, reason: "Khách hủy", cancelledAt: cancelledAt.toISOString(),
  });
});
