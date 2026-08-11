import { NotificationModel } from "../../../model/notification.model";
import { UserModel } from "../../../model/user.model";
import { RetailOrderModel } from "../models/retail-order.model";
import type { RetailBranchScope } from "../contracts";

type OverdueOrder = { _id: unknown; orderCode?: string; customerName?: string; dueAmount: number; dueDate: Date };

export function vietnamBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function buildDebtReminder(order: OverdueOrder, today: string) {
  const orderId = String(order._id);
  const customer = String(order.customerName || "Khách hàng").trim() || "Khách hàng";
  const code = String(order.orderCode || orderId.slice(-6));
  const amount = new Intl.NumberFormat("vi-VN").format(Math.max(0, Number(order.dueAmount) || 0));
  return {
    idempotencyKey: `retail-debt:${orderId}:${today}`,
    title: `Công nợ quá hạn · ${code}`,
    body: `${customer} còn nợ ${amount} ₫. Vui lòng kiểm tra và thu công nợ.`,
  };
}

export class RetailDebtReminderService {
  static async run(scope: RetailBranchScope, now = new Date()) {
    const today = vietnamBusinessDate(now);
    const startOfTodayVietnam = new Date(`${today}T00:00:00+07:00`);
    const [orders, recipients] = await Promise.all([
      RetailOrderModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, status: { $in: ["confirmed", "completed"] }, dueAmount: { $gt: 0 }, dueDate: { $lt: startOfTodayVietnam } }).select("_id orderCode customerName dueAmount dueDate").lean(),
      UserModel.find({
        companyCode: scope.companyCode,
        isActive: { $ne: false },
        $and: [
          { $or: [{ branchId: scope.branchId }, { role: { $in: ["admin", "superadmin"] } }] },
          { $or: [{ role: { $in: ["admin", "superadmin", "manager"] } }, { permissions: "retail:manager" }] },
        ],
      }).select("_id").lean(),
    ]);

    let created = 0;
    let duplicates = 0;
    for (const order of orders as unknown as OverdueOrder[]) {
      const reminder = buildDebtReminder(order, today);
      for (const recipient of recipients) {
        try {
          const result = await NotificationModel.updateOne(
            { companyCode: scope.companyCode, recipientUid: String(recipient._id), idempotencyKey: reminder.idempotencyKey },
            { $setOnInsert: { ...reminder, type: "he-thong", companyCode: scope.companyCode, recipientUid: String(recipient._id), read: false, action: { tab: "BÁN LẺ", subTab: "Đơn hàng" }, createdAt: now } },
            { upsert: true },
          );
          if (result.upsertedCount) created += 1;
          else duplicates += 1;
        } catch (error: any) {
          if (error?.code !== 11000) throw error;
          duplicates += 1;
        }
      }
    }
    return { businessDate: today, overdueOrders: orders.length, recipients: recipients.length, created, duplicates };
  }

  static async runAll(now = new Date()) {
    const today = vietnamBusinessDate(now);
    const startOfTodayVietnam = new Date(`${today}T00:00:00+07:00`);
    const scopes = await RetailOrderModel.aggregate<{ _id: RetailBranchScope }>([
      { $match: { status: { $in: ["confirmed", "completed"] }, dueAmount: { $gt: 0 }, dueDate: { $lt: startOfTodayVietnam } } },
      { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId" } } },
    ]);
    return Promise.all(scopes.map(({ _id }) => this.run(_id, now)));
  }
}

export function startRetailDebtReminderScheduler(intervalMs = 60 * 60 * 1000) {
  const run = () => void RetailDebtReminderService.runAll().catch((error) => console.error("[retail-debt-reminder]", error));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
