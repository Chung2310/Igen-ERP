import { publishDomainEvent, registerDomainConsumer } from "../../../integrations/shared/event-bus";

export interface FinanceReceivableConsumerLedger {
  openFromEvent(scope: any, input: any, actor: any): Promise<any>;
  settleFromEvent(scope: any, sourceType: string, sourceId: string, input: any, actor: any): Promise<any>;
  voidFromEvent(scope: any, sourceType: string, sourceId: string, input: any, actor: any): Promise<any>;
}

export async function publishReceivableSettled(receivable: any, publish: (event: any) => Promise<void> = publishDomainEvent) {
  const settledAt = receivable.updatedAt instanceof Date ? receivable.updatedAt : new Date(receivable.updatedAt || Date.now());
  return publish({
    eventId: `finance-receivable:${receivable._id}:settled`, eventType: "finance.receivable.settled",
    companyCode: String(receivable.companyCode), branchId: String(receivable.branchId), aggregateType: "FinanceReceivable",
    aggregateId: String(receivable._id), occurredAt: settledAt, actorId: "system", actorName: "Finance",
    payload: {
      receivableId: String(receivable._id), sourceType: String(receivable.sourceType), sourceId: String(receivable.sourceId),
      sourceCode: String(receivable.sourceCode || ""), settledAt: settledAt.toISOString(),
    },
  });
}

const context = (event: any) => ({
  scope: { companyCode: String(event.companyCode), branchId: String(event.branchId || event.payload?.branchId || "") },
  actor: { id: String(event.actorId || "system"), name: String(event.actorName || "Hệ thống") },
});

export function createReceivableConsumer(ledger: FinanceReceivableConsumerLedger) {
  return {
    async confirmed(event: any) {
      const payload = event.payload || {};
      if (Number(payload.dueAmount) <= 0) return { skipped: true };
      if (!String(payload.customerId || "").trim()) throw new Error("CUSTOMER_REQUIRED");
      if (!payload.dueDate || Number.isNaN(new Date(payload.dueDate).valueOf())) throw new Error("DUE_DATE_REQUIRED");
      const { scope, actor } = context(event);
      return ledger.openFromEvent(scope, {
        receivableCode: `CN-${payload.orderCode}`, sourceType: "retail_order", sourceId: String(payload.orderId),
        sourceCode: String(payload.orderCode), sourceEventId: String(event.eventId), customerId: String(payload.customerId),
        customerName: String(payload.customerName || ""), originalAmount: Number(payload.dueAmount),
        occurredAt: event.occurredAt instanceof Date ? event.occurredAt : new Date(event.occurredAt), dueDate: new Date(payload.dueDate),
      }, actor);
    },
    paid(event: any) {
      const payload = event.payload || {}; const { scope, actor } = context(event);
      return ledger.settleFromEvent(scope, "retail_order", String(payload.orderId), {
        amount: Number(payload.amount), idempotencyKey: `event:${event.eventId}`, paymentMethod: "retail", reference: String(payload.transactionKey),
      }, actor);
    },
    cancelled(event: any) {
      const payload = event.payload || {};
      if (Number(payload.dueAmount) <= 0) return Promise.resolve({ skipped: true });
      const { scope, actor } = context(event);
      return ledger.voidFromEvent(scope, "retail_order", String(payload.orderId), {
        remainingDebt: Number(payload.dueAmount), refundedAmount: Number(payload.refundedAmount), reason: String(payload.reason), idempotencyKey: `event:${event.eventId}`,
      }, actor);
    },
  };
}

export function registerFinanceReceivableConsumers(ledger: FinanceReceivableConsumerLedger) {
  const consumer = createReceivableConsumer(ledger);
  const registrations = [
    ["retail.order.confirmed", "finance.receivable-open", consumer.confirmed],
    ["retail.order.paid", "finance.receivable-paid", consumer.paid],
    ["retail.order.cancelled", "finance.receivable-cancelled", consumer.cancelled],
  ] as const;
  for (const [eventType, name, handler] of registrations) {
    try { registerDomainConsumer(eventType, name, handler, { requiresModule: "finance" }); }
    catch (error) { if (!String((error as Error).message).includes("đã được đăng ký")) throw error; }
  }
}
