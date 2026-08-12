export type DomainEventType = "retail.order.confirmed" | "retail.order.paid" | "retail.order.cancelled" | "finance.receivable.settled" | "finance.receivable.overdue";

export interface RetailOrderConfirmedPayload { orderId: string; orderCode: string; branchId: string; customerId?: string; customerName?: string; customerPhone?: string; grandTotal: number; paidAmount: number; dueAmount: number; dueDate?: string; }
export interface RetailOrderPaidPayload { orderId: string; orderCode: string; branchId: string; customerId: string; amount: number; transactionKey: string; occurredAt: string; }
export interface RetailOrderCancelledPayload { orderId: string; orderCode: string; branchId: string; customerId?: string; dueAmount: number; refundedAmount: number; reason: string; }
export interface FinanceReceivableSettledPayload { receivableId: string; sourceType: string; sourceId: string; sourceCode: string; settledAt: string; }
export interface FinanceReceivableOverduePayload { receivableId: string; customerId: string; customerPhone?: string; balance: number; daysOverdue: number; sourceCode: string; }

export type DomainPayloadMap = {
  "retail.order.confirmed": RetailOrderConfirmedPayload;
  "retail.order.paid": RetailOrderPaidPayload;
  "retail.order.cancelled": RetailOrderCancelledPayload;
  "finance.receivable.settled": FinanceReceivableSettledPayload;
  "finance.receivable.overdue": FinanceReceivableOverduePayload;
};

export interface NewDomainEvent<T extends DomainEventType = DomainEventType> {
  eventId: string; eventType: T; companyCode: string; branchId?: string;
  aggregateType: string; aggregateId: string; payload: DomainPayloadMap[T];
  occurredAt: Date; actorId: string; actorName: string;
}
