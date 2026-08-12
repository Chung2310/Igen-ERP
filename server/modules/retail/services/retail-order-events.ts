import type { ClientSession } from "mongoose";
import { publishDomainEvent } from "../../../integrations/shared/event-bus";
import type { NewDomainEvent } from "../../../integrations/shared/event-types";
import type { RetailBranchScope } from "../contracts";

type EventName = "confirmed" | "paid" | "cancelled";
type Options = {
  session: ClientSession;
  publish?: (event: NewDomainEvent<any>, session?: ClientSession) => Promise<void>;
  amount?: number;
  transactionKey?: string;
  occurredAt?: Date;
};

const actorId = (actor: any) => String(actor?.id || actor?.uid || "system");
const actorName = (actor: any) => String(actor?.displayName || actor?.name || actor?.email || "Hệ thống");
const date = (value: unknown, fallback = new Date()) => value instanceof Date ? value : value ? new Date(String(value)) : fallback;

export async function publishRetailOrderEvent(event: EventName, scope: RetailBranchScope, order: any, actor: any, options: Options) {
  const publish = options.publish || publishDomainEvent;
  const orderId = String(order._id);
  const base = {
    companyCode: scope.companyCode, branchId: scope.branchId, aggregateType: "RetailOrder", aggregateId: orderId,
    actorId: actorId(actor), actorName: actorName(actor),
  };
  if (event === "confirmed") {
    const occurredAt = date(order.confirmedAt);
    return publish({
      ...base, eventId: `retail-order:${orderId}:confirmed`, eventType: "retail.order.confirmed", occurredAt,
      payload: {
        orderId, orderCode: String(order.orderCode), branchId: scope.branchId, customerId: order.customerId ? String(order.customerId) : undefined,
        customerName: order.customerName, customerPhone: order.customerPhone, grandTotal: order.grandTotal,
        paidAmount: order.paidAmount, dueAmount: order.dueAmount, dueDate: order.dueDate ? date(order.dueDate).toISOString() : undefined,
      },
    }, options.session);
  }
  if (event === "paid") {
    const transactionKey = String(options.transactionKey || "").trim();
    if (!transactionKey) throw new Error("RETAIL_PAYMENT_TRANSACTION_KEY_REQUIRED");
    const occurredAt = options.occurredAt || new Date();
    return publish({
      ...base, eventId: `retail-order:${orderId}:paid:${transactionKey}`, eventType: "retail.order.paid", occurredAt,
      payload: { orderId, orderCode: String(order.orderCode), branchId: scope.branchId, customerId: String(order.customerId), amount: Number(options.amount), transactionKey, occurredAt: occurredAt.toISOString() },
    }, options.session);
  }
  const occurredAt = date(order.cancelledAt);
  return publish({
    ...base, eventId: `retail-order:${orderId}:cancelled`, eventType: "retail.order.cancelled", occurredAt,
    payload: {
      orderId, orderCode: String(order.orderCode), branchId: scope.branchId, customerId: order.customerId ? String(order.customerId) : undefined,
      dueAmount: Number(order.dueAmount), refundedAmount: Number(order.refundedAmount), reason: String(order.cancelReason), cancelledAt: occurredAt.toISOString(),
    },
  }, options.session);
}
