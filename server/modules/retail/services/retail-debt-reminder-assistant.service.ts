import { UserModel } from "../../../model/user.model";
import { getCustomerContact } from "../../customer-management/contracts";
import type { RetailBranchScope } from "../contracts";
import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";
import { RetailOrderModel } from "../models/retail-order.model";

const retryableEmailFilter = (scope: RetailBranchScope) => ({
  ...scope,
  channel: "email" as const,
  status: "failed" as const,
  failureType: "temporary" as const,
  $expr: { $lt: ["$attempt", "$maxAttempts"] } as any,
});

export const RetailDebtReminderAssistantService = {
  async listRetryable(scope: RetailBranchScope, input: { page?: unknown; limit?: unknown } = {}) {
    const page = Math.max(1, Math.floor(Number(input.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit) || 20)));
    const filter = retryableEmailFilter(scope);
    const [deliveries, total] = await Promise.all([
      RetailDebtReminderDeliveryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("_id orderId recipientId recipientType payload.to payload.subject payload.text attempt maxAttempts createdAt")
        .lean(),
      RetailDebtReminderDeliveryModel.countDocuments(filter),
    ]);

    const orderIds = [...new Set(deliveries.map((item: any) => String(item.orderId || "")).filter(Boolean))];
    const creatorIds = [...new Set(deliveries
      .filter((item: any) => item.recipientType === "creator")
      .map((item: any) => String(item.recipientId || "").replace(/^creator:/, ""))
      .filter(Boolean))];
    const customerIds = [...new Set(deliveries
      .filter((item: any) => item.recipientType === "customer")
      .map((item: any) => String(item.recipientId || "").replace(/^customer:/, ""))
      .filter(Boolean))];

    const [orders, creators, customerContacts] = await Promise.all([
      orderIds.length
        ? RetailOrderModel.find({ ...scope, _id: { $in: orderIds } }).select("_id orderCode customerName").lean()
        : Promise.resolve([]),
      creatorIds.length
        ? UserModel.find({ companyCode: scope.companyCode, _id: { $in: creatorIds } }).select("_id displayName email").lean()
        : Promise.resolve([]),
      Promise.all(customerIds.map(async (id) => [id, await getCustomerContact({ companyCode: scope.companyCode }, id, { includeInactive: true })] as const)),
    ]);
    const ordersById = new Map((orders as any[]).map((item) => [String(item._id), item]));
    const creatorsById = new Map((creators as any[]).map((item) => [String(item._id), item]));
    const customersById = new Map(customerContacts);

    const items = deliveries.map((delivery: any) => {
      const order = ordersById.get(String(delivery.orderId || ""));
      const recipientId = String(delivery.recipientId || "").replace(/^(customer|creator):/, "");
      const recipient = delivery.recipientType === "customer"
        ? customersById.get(recipientId)
        : creatorsById.get(recipientId);
      return {
        _id: String(delivery._id),
        recipientName: String(recipient?.name || recipient?.displayName || order?.customerName || "Người nhận không xác định"),
        recipientEmail: String(delivery.payload?.to || recipient?.email || ""),
        orderCode: String(order?.orderCode || "Đơn hàng không còn tồn tại"),
        subject: String(delivery.payload?.subject || "").slice(0, 200),
        message: String(delivery.payload?.text || "").slice(0, 1500),
        attempt: Number(delivery.attempt || 0),
        maxAttempts: Number(delivery.maxAttempts || 0),
        createdAt: delivery.createdAt,
      };
    });
    return { items, total, page, limit };
  },

  async retry(scope: RetailBranchScope, id: string, now = new Date()) {
    const item = await RetailDebtReminderDeliveryModel.findOneAndUpdate(
      { _id: id, ...retryableEmailFilter(scope) },
      { $set: { status: "queued", nextAttemptAt: now }, $unset: { error: 1 } },
      { returnDocument: "after" },
    ).select("status nextAttemptAt").lean();
    if (item) return { status: "queued", nextAttemptAt: item.nextAttemptAt };

    const exists = await RetailDebtReminderDeliveryModel.exists({ _id: id, ...scope });
    if (!exists) throw Object.assign(new Error("Không tìm thấy delivery trong chi nhánh hiện tại."), { status: 404 });
    throw Object.assign(new Error("Chỉ được thử lại email lỗi tạm thời còn lượt gửi."), { status: 409 });
  },
};
