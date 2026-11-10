import { describe, expect, it, vi } from "vitest";
import {
  buildRetailOrderCustomerNotification,
  createRetailOrderCustomerNotificationConsumer,
} from "./retail-order-customer-notification.consumer";

const order = {
  _id: "messenger-order1",
  isSimulation: false,
  companyCode: "ACME",
  pageId: "PAGE1",
  conversationId: "conversation1",
  retailCustomerNotifiedEventIds: [],
  orderCode: "DH-001",
  retailStatus: "confirmed",
  paymentStatus: "partial",
  paidAmount: 50_000,
  dueAmount: 150_000,
  grandTotal: 200_000,
};

function event(eventType: "retail.order.confirmed" | "retail.order.paid" | "retail.order.cancelled", payload: Record<string, unknown> = {}) {
  return { eventId: "event-1", eventType, companyCode: "ACME", aggregateId: "retail-order1", payload } as const;
}

describe("Retail order Page customer notifications", () => {
  it("uses current Retail totals in the confirmed order message", () => {
    expect(buildRetailOrderCustomerNotification(event("retail.order.confirmed"), order))
      .toBe("Tiệm đã xác nhận đơn DH-001. Tổng đơn 200.000đ. Đã thanh toán 50.000đ, còn lại 150.000đ.");
  });

  it("notifies the customer when Retail records a payment", () => {
    expect(buildRetailOrderCustomerNotification(event("retail.order.paid", { amount: 50_000 }), order))
      .toBe("Tiệm đã ghi nhận thanh toán 50.000đ cho đơn DH-001. Đơn còn phải thanh toán 150.000đ.");
  });

  it("notifies cancellation and only mentions refunds recorded in the event", () => {
    expect(buildRetailOrderCustomerNotification(event("retail.order.cancelled", {
      reason: "Khách đổi lịch", refundedAmount: 80_000,
    }), order)).toBe("Tiệm đã cập nhật đơn DH-001 sang trạng thái đã hủy. Lý do: Khách đổi lịch. ERP ghi nhận số tiền đã hoàn 80.000đ.");
  });

  it("sends each linked real order event once and skips simulation data", async () => {
    const send = vi.fn(async () => undefined);
    const notified = new Set<string>();
    const markSent = vi.fn(async (incoming: { eventId: string }) => { notified.add(incoming.eventId); });
    const findLinkedOrder = vi.fn(async () => ({ ...order, retailCustomerNotifiedEventIds: [...notified] }));
    const notify = createRetailOrderCustomerNotificationConsumer({ findLinkedOrder, send, markSent });
    const confirmed = event("retail.order.confirmed");

    await notify(confirmed);
    await notify(confirmed);
    expect(send).toHaveBeenCalledTimes(1);
    expect(markSent).toHaveBeenCalledTimes(1);

    findLinkedOrder.mockResolvedValueOnce({ ...order, isSimulation: true });
    await notify(event("retail.order.paid", { amount: 50_000 }));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("propagates delivery errors so the domain outbox can retry", async () => {
    const send = vi.fn(async () => { throw new Error("Facebook unavailable"); });
    const markSent = vi.fn(async () => undefined);
    const notify = createRetailOrderCustomerNotificationConsumer({
      findLinkedOrder: async () => order,
      send,
      markSent,
    });

    await expect(notify(event("retail.order.confirmed"))).rejects.toThrow("Facebook unavailable");
    expect(markSent).not.toHaveBeenCalled();
  });
});
