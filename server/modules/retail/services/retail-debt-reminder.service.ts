import { NotificationModel } from "../../../model/notification.model";
import { UserModel } from "../../../model/user.model";
import { RetailOrderModel } from "../models/retail-order.model";
import type { RetailBranchScope } from "../contracts";
import type { RetailDebtReminderSettings } from "../interfaces/retail-settings.interface";
import { RetailDebtReminderRunModel } from "../models/retail-debt-reminder-run.model";
import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { getCustomerContact } from "../../customer-management/contracts";

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
  const message = String(error?.message || error || "").toLowerCase();
  const configurationError = message.includes("smtp chua duoc cau hinh") || message.includes("smtp configuration is incomplete");
  return configurationError || (responseCode >= 500 && responseCode < 600) ? "permanent" : "temporary";
}
export function reminderDeliveryChannels(emailEnabled: boolean, email: unknown): Array<"notification" | "email"> { return emailEnabled && String(email || "").trim() ? ["notification", "email"] : ["notification"]; }

type OverdueOrder = { _id: unknown; orderCode?: string; customerId?: string; customerName?: string; createdBy?: string; dueAmount: number; dueDate: Date };
type ReminderParty = { _id?: unknown; customerId?: string; name?: string; displayName?: string; email?: string } | null | undefined;
type ReminderPlan = { recipientId: string; recipientType: "customer" | "creator"; channel: "notification" | "email"; status: "queued" | "failed"; maxAttempts: number; payload: Record<string, string>; failureType?: "permanent"; error?: string };

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

export function buildDebtReminderRecipientPlans(order: OverdueOrder, customer: ReminderParty, creator: ReminderParty, today: string, emailEnabled: boolean, maxAttempts: number): ReminderPlan[] {
  const reminder = buildDebtReminder(order, today);
  const dueDate = order.dueDate ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(order.dueDate) : "chưa xác định";
  const amount = new Intl.NumberFormat("vi-VN").format(Math.max(0, Number(order.dueAmount) || 0));
  const code = String(order.orderCode || String(order._id).slice(-6));
  const customerName = String(customer?.name || order.customerName || "Khách hàng").trim();
  const customerEmail = String(customer?.email || "").trim();
  const creatorEmail = String(creator?.email || "").trim();
  const customerError = !order.customerId ? "CUSTOMER_ID_MISSING" : !customer ? "CUSTOMER_NOT_FOUND" : !customerEmail ? "CUSTOMER_EMAIL_MISSING" : undefined;
  const creatorError = !order.createdBy ? "CREATOR_ID_MISSING" : !creator ? "CREATOR_NOT_FOUND" : undefined;
  const customerPayload = { recipientType: "customer", to: customerEmail, subject: `Nhắc thanh toán công nợ · ${code}`, text: `Kính gửi ${customerName}, đơn hàng ${code} còn công nợ ${amount} ₫, hạn thanh toán ${dueDate}. Vui lòng thanh toán hoặc liên hệ doanh nghiệp để được hỗ trợ.` };
  const creatorPayload = { recipientType: "creator", to: creatorEmail, subject: reminder.title, text: `${reminder.body} Hạn thanh toán: ${dueDate}. Vui lòng theo dõi thu hồi công nợ.`, idempotencyKey: `${reminder.idempotencyKey}:creator:${String(order.createdBy || "missing")}` };
  return [
    { recipientId: `customer:${String(order.customerId || "missing")}`, recipientType: "customer", channel: "email", status: customerError || !emailEnabled ? "failed" : "queued", maxAttempts, payload: customerPayload, ...(customerError ? { failureType: "permanent" as const, error: customerError } : !emailEnabled ? { failureType: "permanent" as const, error: "EMAIL_REMINDERS_DISABLED" } : {}) },
    { recipientId: `creator:${String(order.createdBy || "missing")}`, recipientType: "creator", channel: "notification", status: creatorError ? "failed" : "queued", maxAttempts, payload: creatorPayload, ...(creatorError ? { failureType: "permanent" as const, error: creatorError } : {}) },
    { recipientId: `creator:${String(order.createdBy || "missing")}`, recipientType: "creator", channel: "email", status: creatorError || !creatorEmail || !emailEnabled ? "failed" : "queued", maxAttempts, payload: creatorPayload, ...(creatorError ? { failureType: "permanent" as const, error: creatorError } : !creatorEmail ? { failureType: "permanent" as const, error: "CREATOR_EMAIL_MISSING" } : !emailEnabled ? { failureType: "permanent" as const, error: "EMAIL_REMINDERS_DISABLED" } : {}) },
  ];
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
    const orders: any[] = await RetailOrderModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, status: { $in: ["confirmed", "completed"] }, dueAmount: { $gt: 0 }, dueDate: { $lt: startOfTodayVietnam } }).select("_id orderCode customerId customerName createdBy dueAmount dueDate").lean();
    const customerIds = [...new Set(orders.map((order) => String(order.customerId || "")).filter(Boolean))];
    const creatorIds = [...new Set(orders.map((order) => String(order.createdBy || "")).filter(Boolean))];
    const creators = await UserModel.find({ companyCode: scope.companyCode, _id: { $in: creatorIds }, isActive: { $ne: false } }).select("_id displayName email").lean();
    const customerContacts = await Promise.all(customerIds.map(async (customerId) => [customerId, await getCustomerContact({ companyCode: scope.companyCode }, customerId, { includeInactive: true })] as const));
    const customerById = new Map(customerContacts.map(([customerId, customer]) => [customerId, customer]));
    const creatorById = new Map(creators.map((item: any) => [String(item._id), item]));

    let created = 0;
    let duplicates = 0;
    for (const order of orders as unknown as OverdueOrder[]) {
      const reminder = buildDebtReminder(order, today);
      const customer = customerById.get(String(order.customerId || ""));
      const creator = creatorById.get(String(order.createdBy || ""));
      const plans = buildDebtReminderRecipientPlans(order, customer, creator, today, settings.emailEnabled, settings.maxAttempts);
      const customerPlan = plans[0];
      await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), ...customerPlan, nextAttemptAt: customerPlan.status === "queued" ? now : undefined }).catch((error: any) => { if (error?.code === 11000) duplicates += 1; else throw error; });
      if (!creator) {
        for (const plan of plans.slice(1)) await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), ...plan });
        continue;
      }
      const recipients = [creator];
      for (const recipient of recipients) {
        const creatorNotificationPlan = plans[1];
        const deliveryPayload = { ...reminder, ...creatorNotificationPlan.payload, to: String((recipient as any).email || "") };
        let delivery: any;
        try {
          delivery = await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), ...creatorNotificationPlan, payload: deliveryPayload });
          const result = await NotificationModel.updateOne(
            { companyCode: scope.companyCode, recipientUid: String(recipient._id), idempotencyKey: creatorNotificationPlan.payload.idempotencyKey },
            { $setOnInsert: { title: creatorNotificationPlan.payload.subject, body: creatorNotificationPlan.payload.text, idempotencyKey: creatorNotificationPlan.payload.idempotencyKey, type: "he-thong", companyCode: scope.companyCode, recipientUid: String(recipient._id), read: false, action: { tab: "BÁN LẺ", subTab: "Đơn hàng" }, createdAt: now } },
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
        const creatorEmailPlan = plans[2];
        if (creatorEmailPlan.status === "queued") {
          try {
            await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), ...creatorEmailPlan, nextAttemptAt: now });
          } catch (error: any) { if (error?.code !== 11000) throw error; }
        } else {
          await RetailDebtReminderDeliveryModel.create({ ...scope, runId: run._id, orderId: String(order._id), ...creatorEmailPlan });
        }
      }
    }
    const deliveryRows: any[] = await RetailDebtReminderDeliveryModel.find({ runId: run._id }).select("status").lean();
    const stats = summarizeReminderDeliveries(deliveryRows.map((item) => item.status));
    await RetailDebtReminderRunModel.updateOne({ _id: run._id }, { $set: { status: "completed", completedAt: new Date(), overdueOrders: orders.length, recipients: orders.length * 2, ...stats } });
    return { businessDate: today, cycleKey, overdueOrders: orders.length, recipients: orders.length * 2, created, duplicates };
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
