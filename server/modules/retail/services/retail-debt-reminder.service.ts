import { NotificationModel } from "../../../model/notification.model";
import { UserModel } from "../../../model/user.model";
import { RetailOrderModel } from "../models/retail-order.model";
import type { RetailBranchScope } from "../contracts";
import type { RetailDebtReminderSettings } from "../interfaces/retail-settings.interface";
import { RetailDebtReminderRunModel } from "../models/retail-debt-reminder-run.model";
import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";
import { getResolvedRetailSettings } from "./retail-settings.service";

export function reminderCycleKey(now: Date, frequencyHours: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const hour = Math.floor(Number(value("hour")) / frequencyHours) * frequencyHours;
  return `${value("year")}-${value("month")}-${value("day")}/${String(hour).padStart(2, "0")}`;
}

export function buildReminderRunSnapshot(settings: RetailDebtReminderSettings, businessDate: string) {
  return { cycleKey: `${businessDate}/${settings.frequencyHours}`, settings: structuredClone(settings) };
}

export function summarizeReminderDeliveries(statuses: Array<"queued" | "sent" | "failed" | "duplicate">) {
  const result = { total: statuses.length, queued: 0, sent: 0, failed: 0, duplicates: 0 };
  for (const status of statuses) status === "duplicate" ? result.duplicates++ : result[status]++;
  return result;
}

export function classifyReminderFailure(error: any): "temporary" | "permanent" {
  const responseCode = Number(error?.responseCode || 0);
  return responseCode >= 500 && responseCode < 600 ? "permanent" : "temporary";
}

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
    const resolved = await getResolvedRetailSettings(scope);
    const settings = resolved.debtReminders;
    const today = vietnamBusinessDate(now);
    if (!settings.enabled) return { businessDate: today, skipped: true, overdueOrders: 0, recipients: 0, created: 0, duplicates: 0 };
    const startOfTodayVietnam = new Date(new Date(`${today}T00:00:00+07:00`).getTime() - settings.overdueDays * 86_400_000);
    const cycleKey = reminderCycleKey(now, settings.frequencyHours);
    let run: any;
    try {
      run = await RetailDebtReminderRunModel.create({ ...scope, cycleKey, businessDate: today, status: "running", settings: structuredClone(settings), startedAt: now });
    } catch (error: any) {
      if (error?.code === 11000) return { businessDate: today, cycleKey, skipped: true, overdueOrders: 0, recipients: 0, created: 0, duplicates: 0 };
      throw error;
    }
    const [orders, recipients] = await Promise.all([
      RetailOrderModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, status: { $in: ["confirmed", "completed"] }, dueAmount: { $gt: 0 }, dueDate: { $lt: startOfTodayVietnam } }).select("_id orderCode customerName dueAmount dueDate").lean(),
      UserModel.find({
        companyCode: scope.companyCode,
        isActive: { $ne: false },
        $and: [
          { $or: [{ branchId: scope.branchId }, { role: { $in: ["admin", "superadmin"] } }] },
          { $or: [{ _id: { $in: settings.recipientUserIds } }, { role: { $in: settings.recipientRoles } }] },
        ],
      }).select("_id email").lean(),
    ]);

    let created = 0;
    let duplicates = 0;
    for (const order of orders as unknown as OverdueOrder[]) {
      const reminder = buildDebtReminder(order, today);
      for (const recipient of recipients) {
        const deliveryPayload = { ...reminder, to: String((recipient as any).email || "") };
        let delivery: any;
        try {
          delivery = await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), recipientId: String(recipient._id), channel: "notification", status: "queued", maxAttempts: settings.maxAttempts, payload: deliveryPayload });
          const result = await NotificationModel.updateOne(
            { companyCode: scope.companyCode, recipientUid: String(recipient._id), idempotencyKey: reminder.idempotencyKey },
            { $setOnInsert: { ...reminder, type: "he-thong", companyCode: scope.companyCode, recipientUid: String(recipient._id), read: false, action: { tab: "BÁN LẺ", subTab: "Đơn hàng" }, createdAt: now } },
            { upsert: true },
          );
          if (result.upsertedCount) { created += 1; await RetailDebtReminderDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "sent", sentAt: now }, $inc: { attempt: 1 } }); }
          else { duplicates += 1; await RetailDebtReminderDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "duplicate" } }); }
        } catch (error: any) {
          if (error?.code === 11000) duplicates += 1;
          else {
            if (delivery?._id) await RetailDebtReminderDeliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "failed", failureType: classifyReminderFailure(error), error: String(error?.message || error) }, $inc: { attempt: 1 } });
          }
        }
      }
    }
    const deliveryRows: any[] = await RetailDebtReminderDeliveryModel.find({ runId: run._id }).select("status").lean();
    const stats = summarizeReminderDeliveries(deliveryRows.map((item) => item.status));
    await RetailDebtReminderRunModel.updateOne({ _id: run._id }, { $set: { status: "completed", completedAt: new Date(), overdueOrders: orders.length, recipients: recipients.length, ...stats } });
    return { businessDate: today, cycleKey, overdueOrders: orders.length, recipients: recipients.length, created, duplicates };
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
