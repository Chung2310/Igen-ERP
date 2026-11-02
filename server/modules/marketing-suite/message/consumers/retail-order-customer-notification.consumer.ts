import { registerDomainConsumer } from "../../../../integrations/shared/event-bus";
import type { DomainEventType } from "../../../../integrations/shared/event-types";
import { RetailOrderModel } from "../../../retail/models/retail-order.model";
import { FBConversationModel } from "../model/fb-messenger.model";
import { MessengerOrderModel } from "../model/messenger-order.model";

type RetailOrderNotificationType = Extract<DomainEventType,
  "retail.order.confirmed" | "retail.order.paid" | "retail.order.cancelled">;

type NotificationEvent = {
  eventId: string;
  eventType: RetailOrderNotificationType;
  companyCode: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

type LinkedOrder = {
  _id: string;
  isSimulation: boolean;
  companyCode: string;
  pageId: string;
  conversationId: string;
  retailCustomerNotifiedEventIds: string[];
  orderCode: string;
  retailStatus: string;
  paymentStatus: string;
  paidAmount: number;
  dueAmount: number;
  grandTotal: number;
};

type Dependencies = {
  findLinkedOrder(event: NotificationEvent): Promise<LinkedOrder | undefined>;
  send(linked: LinkedOrder, text: string): Promise<void>;
  markSent(event: NotificationEvent, linked: LinkedOrder): Promise<void>;
};

const money = (value: unknown) => `${Math.round(Number(value) || 0).toLocaleString("vi-VN")}đ`;

export function buildRetailOrderCustomerNotification(event: NotificationEvent, order: LinkedOrder) {
  const code = String(event.payload?.orderCode || order.orderCode || "").trim();
  const name = code ? `đơn ${code}` : "đơn hàng";
  if (event.eventType === "retail.order.confirmed") {
    const paymentText = order.dueAmount <= 0
      ? "Đơn đã được thanh toán đủ."
      : order.paidAmount > 0
        ? `Đã thanh toán ${money(order.paidAmount)}, còn lại ${money(order.dueAmount)}.`
        : `Số tiền cần thanh toán là ${money(order.dueAmount)}.`;
    return `Tiệm đã xác nhận ${name}. Tổng đơn ${money(order.grandTotal)}. ${paymentText}`;
  }
  if (event.eventType === "retail.order.paid") {
    const amount = money(event.payload?.amount);
    const paymentText = order.dueAmount <= 0
      ? "Đơn đã được thanh toán đủ."
      : `Đơn còn phải thanh toán ${money(order.dueAmount)}.`;
    return `Tiệm đã ghi nhận thanh toán ${amount} cho ${name}. ${paymentText}`;
  }
  const reason = String(event.payload?.reason || "").trim();
  const refundedAmount = Number(event.payload?.refundedAmount || 0);
  return [
    `Tiệm đã cập nhật ${name} sang trạng thái đã hủy.`,
    reason ? `Lý do: ${reason}.` : "",
    refundedAmount > 0 ? `ERP ghi nhận số tiền đã hoàn ${money(refundedAmount)}.` : "",
  ].filter(Boolean).join(" ");
}

export function createRetailOrderCustomerNotificationConsumer(dependencies: Dependencies) {
  return async (event: NotificationEvent) => {
    const linked = await dependencies.findLinkedOrder(event);
    if (!linked || linked.isSimulation) return;
    if (linked.retailCustomerNotifiedEventIds.includes(event.eventId)) return;
    const text = buildRetailOrderCustomerNotification(event, linked);
    await dependencies.send(linked, text);
    await dependencies.markSent(event, linked);
  };
}

const productionDependencies: Dependencies = {
  async findLinkedOrder(event) {
    const companyCode = String(event.companyCode || "").trim().toUpperCase();
    if (!companyCode || !event.aggregateId) return undefined;
    const retailOrder: any = await RetailOrderModel.findOne({ _id: event.aggregateId, companyCode })
      .select("orderCode externalOrderId status paymentStatus paidAmount dueAmount grandTotal isSimulation")
      .lean();
    if (!retailOrder) return undefined;
    const linkFilter: Record<string, unknown>[] = [{ retailOrderId: String(retailOrder._id) }];
    if (retailOrder.externalOrderId) linkFilter.push({ orderId: String(retailOrder.externalOrderId) });
    const messengerOrder: any = await MessengerOrderModel.findOne({ companyCode, $or: linkFilter })
      .select("_id orderId pageId conversationId isSimulation retailCustomerNotifiedEventIds")
      .lean();
    if (!messengerOrder) return undefined;
    const conversation = await FBConversationModel.findOne({ _id: messengerOrder.conversationId, pageId: messengerOrder.pageId })
      .select("_id recipientId isSimulation")
      .lean();
    if (!conversation?.recipientId) throw new Error("PAGE_ORDER_NOTIFICATION_CONVERSATION_NOT_FOUND");
    return {
      _id: String(messengerOrder._id),
      isSimulation: retailOrder.isSimulation === true || messengerOrder.isSimulation === true || conversation.isSimulation === true,
      companyCode,
      pageId: String(messengerOrder.pageId),
      conversationId: String(messengerOrder.conversationId),
      retailCustomerNotifiedEventIds: messengerOrder.retailCustomerNotifiedEventIds || [],
      orderCode: String(retailOrder.orderCode || ""),
      retailStatus: String(retailOrder.status || ""),
      paymentStatus: String(retailOrder.paymentStatus || ""),
      paidAmount: Number(retailOrder.paidAmount || 0),
      dueAmount: Number(retailOrder.dueAmount || 0),
      grandTotal: Number(retailOrder.grandTotal || 0),
    } as LinkedOrder;
  },
  async send(linked, text) {
    const { fbMessengerService } = await import("../service/fb-messenger.service.ts");
    await fbMessengerService.sendReply(linked.pageId, linked.conversationId, text, "ai", {
      companyCode: linked.companyCode,
      source: "company",
    }, `retail-order-${linked.orderCode}`);
  },
  async markSent(event, linked) {
    await MessengerOrderModel.updateOne({ _id: linked._id }, {
      $addToSet: { retailCustomerNotifiedEventIds: event.eventId },
    });
  },
};

const notifyRetailOrderCustomer = createRetailOrderCustomerNotificationConsumer(productionDependencies);

export function registerRetailOrderCustomerNotificationConsumers() {
  const registrations: Array<[RetailOrderNotificationType, string]> = [
    ["retail.order.confirmed", "page-order-customer-confirmed"],
    ["retail.order.paid", "page-order-customer-paid"],
    ["retail.order.cancelled", "page-order-customer-cancelled"],
  ];
  for (const [eventType, name] of registrations) {
    try { registerDomainConsumer(eventType, name, notifyRetailOrderCustomer); }
    catch (error) {
      if (!String((error as Error).message).includes("đã được đăng ký")) throw error;
    }
  }
}
