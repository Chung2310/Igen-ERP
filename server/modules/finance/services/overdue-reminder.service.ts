import type { FinanceBranchScope } from "../contracts";
import type { FinanceReminderSettings } from "../config/finance-settings";
import { DEFAULT_FINANCE_REMINDER_SETTINGS } from "../config/finance-settings";
import { ReminderRunModel } from "../models/reminder-run.model";
import { ReminderDeliveryModel } from "../models/reminder-delivery.model";
import { ReceivableModel } from "../models/receivable.model";
import { NotificationModel } from "../../../model/notification.model";
import { UserModel } from "../../../model/user.model";
import { publishDomainEvent } from "../../../integrations/shared/event-bus";
import { getEnabledModulesForCompany } from "../../../middleware/require-module";

export function businessDateInTimeZone(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function dayNumber(date: Date, timeZone: string) {
  const [year, month, day] = businessDateInTimeZone(date, timeZone).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function isReceivableReminderEligible(receivable: any, now: Date, settings: Pick<FinanceReminderSettings, "timeZone" | "reminderIntervalDays">) {
  if (!["open", "partially_paid"].includes(String(receivable.status)) || Number(receivable.balance) <= 0) return false;
  if (!(receivable.dueDate instanceof Date) || dayNumber(receivable.dueDate, settings.timeZone) >= dayNumber(now, settings.timeZone)) return false;
  if (receivable.reminderSuspendedUntil && new Date(receivable.reminderSuspendedUntil) > now) return false;
  if (receivable.lastReminderAt && dayNumber(now, settings.timeZone) - dayNumber(new Date(receivable.lastReminderAt), settings.timeZone) < settings.reminderIntervalDays) return false;
  return true;
}

export function reminderCycleKey(scope: FinanceBranchScope, businessDate: string, receivableId: string, channel: "in_app" | "marketing") {
  return `${scope.companyCode}:${scope.branchId}:${businessDate}:${receivableId}:${channel}`;
}

const RETRY_DELAYS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000] as const;
export function nextReminderRetryAt(attempt: number, now: Date) { return new Date(now.getTime() + RETRY_DELAYS[Math.min(RETRY_DELAYS.length, Math.max(1, attempt)) - 1]); }
export function reminderRetryDecision(failureType: "temporary" | "permanent", attempt: number, maxAttempts: number) { return { retry: failureType === "temporary" && attempt < maxAttempts }; }

type RetryDependencies = { claim(id: string, now: Date): Promise<any | null>; send(delivery: any): Promise<void>; update(id: string, values: any): Promise<void> };
export async function retryReminderDeliveryWith(id: string, now: Date, dependencies: RetryDependencies) {
  const delivery = await dependencies.claim(id, now);
  if (!delivery) throw new Error("DELIVERY_NOT_RETRYABLE");
  try {
    await dependencies.send(delivery);
    const values = { status: "sent", sentAt: now, failureType: undefined, error: undefined, nextAttemptAt: undefined };
    await dependencies.update(String(delivery._id), values); return { status: "sent" as const };
  } catch (error) {
    const decision = reminderRetryDecision("temporary", delivery.attempt, delivery.maxAttempts);
    await dependencies.update(String(delivery._id), { status: "failed", failureType: "temporary", error: (error as Error).message, nextAttemptAt: decision.retry ? nextReminderRetryAt(delivery.attempt, now) : undefined });
    return { status: "failed" as const, retry: decision.retry };
  }
}

type Dependencies = {
  settings(scope: FinanceBranchScope): Promise<FinanceReminderSettings>;
  findCandidates(scope: FinanceBranchScope): Promise<any[]>;
  createRun(values: any): Promise<any | null>;
  completeRun(id: string, values: any): Promise<void>;
  createDelivery(values: any): Promise<any | null>;
  updateDelivery(id: string, values: any): Promise<void>;
  createNotification(payload: any): Promise<void>;
  marketingEnabled(companyCode: string): Promise<boolean>;
  publishOverdue(event: any): Promise<void>;
  updateReminderCache(scope: FinanceBranchScope, id: string, values: any): Promise<void>;
};

export function createOverdueReminderService(dependencies: Dependencies) {
  return {
    async runOverdueScan(scope: FinanceBranchScope, trigger: "scheduled" | "manual", actor?: any, now = new Date()) {
      const settings = await dependencies.settings(scope); const businessDate = businessDateInTimeZone(now, settings.timeZone);
      const run = await dependencies.createRun({ ...scope, cycleKey: `${scope.companyCode}:${scope.branchId}:${businessDate}:${trigger}`, businessDate, trigger, actorId: actor?.id, status: "running", startedAt: now });
      if (!run) return { eligible: 0, queued: 0, skipped: 0, failed: 0, duplicates: 0 };
      const candidates = (await dependencies.findCandidates(scope)).filter((item) => isReceivableReminderEligible(item, now, settings));
      const stats = { eligible: candidates.length, queued: 0, skipped: 0, failed: 0, duplicates: 0 };
      const marketing = await dependencies.marketingEnabled(scope.companyCode);
      for (const item of candidates) {
        let enqueued = false;
        const daysOverdue = dayNumber(now, settings.timeZone) - dayNumber(item.dueDate, settings.timeZone);
        const payload = { receivableId: String(item._id), customerId: String(item.customerId), balance: Number(item.balance), daysOverdue, sourceCode: String(item.sourceCode || "") };
        for (const channel of ["in_app", "marketing"] as const) {
          const cycleKey = reminderCycleKey(scope, businessDate, String(item._id), channel);
          const delivery = await dependencies.createDelivery({ ...scope, runId: run._id, receivableId: String(item._id), cycleKey, channel, status: "queued", attempt: 0, maxAttempts: settings.maxAttempts, payload, nextAttemptAt: now });
          if (!delivery) { stats.duplicates += 1; continue; }
          if (channel === "marketing" && !marketing) { await dependencies.updateDelivery(String(delivery._id), { status: "skipped" }); stats.skipped += 1; continue; }
          try {
            if (channel === "in_app") await dependencies.createNotification({ ...scope, ...payload, idempotencyKey: cycleKey });
            else await dependencies.publishOverdue({ ...scope, ...payload, eventId: cycleKey, occurredAt: now });
            stats.queued += 1; enqueued = true;
          } catch (error) {
            await dependencies.updateDelivery(String(delivery._id), { status: "failed", failureType: "temporary", error: (error as Error).message, nextAttemptAt: new Date(now.getTime() + 60_000) }); stats.failed += 1;
          }
        }
        if (enqueued) await dependencies.updateReminderCache(scope, String(item._id), { daysOverdue, lastReminderAt: now, reminderCount: Number(item.reminderCount || 0) + 1 });
      }
      await dependencies.completeRun(String(run._id), { status: "completed", completedAt: now, ...stats });
      return stats;
    },
  };
}

const duplicate = (error: any) => error?.code === 11000;
const mongoDependencies: Dependencies = {
  settings: async () => ({ ...DEFAULT_FINANCE_REMINDER_SETTINGS }),
  findCandidates: (scope) => ReceivableModel.find({ ...scope, status: { $in: ["open", "partially_paid"] }, balance: { $gt: 0 } }).lean(),
  async createRun(values) { try { return await ReminderRunModel.create(values); } catch (error) { if (duplicate(error)) return null; throw error; } },
  async completeRun(id, values) { await ReminderRunModel.updateOne({ _id: id }, { $set: values }); },
  async createDelivery(values) { try { return await ReminderDeliveryModel.create(values); } catch (error) { if (duplicate(error)) return null; throw error; } },
  async updateDelivery(id, values) { await ReminderDeliveryModel.updateOne({ _id: id }, { $set: values }); },
  async createNotification(payload) {
    const recipients: any[] = await UserModel.find({
      companyCode: payload.companyCode, isActive: { $ne: false },
      $and: [{ $or: [{ branchId: payload.branchId }, { role: { $in: ["admin", "superadmin"] } }] }, { $or: [{ permissions: "receivable:read" }, { role: { $in: ["admin", "superadmin"] } }] }],
    }).select("_id").lean();
    for (const recipient of recipients) await NotificationModel.updateOne(
      { companyCode: payload.companyCode, recipientUid: String(recipient._id), idempotencyKey: payload.idempotencyKey },
      { $setOnInsert: { title: `Công nợ quá hạn · ${payload.sourceCode}`, body: `Khoản công nợ còn ${payload.balance} ₫ và đã quá hạn ${payload.daysOverdue} ngày.`, type: "he-thong", companyCode: payload.companyCode, recipientUid: String(recipient._id), idempotencyKey: payload.idempotencyKey, read: false, action: { tab: "TÀI CHÍNH", subTab: "cong-no" }, createdAt: new Date() } },
      { upsert: true },
    );
  },
  marketingEnabled: async (companyCode) => Boolean((await getEnabledModulesForCompany(companyCode))?.includes("marketing")),
  publishOverdue: (event) => publishDomainEvent({
    eventId: event.eventId, eventType: "finance.receivable.overdue", companyCode: event.companyCode, branchId: event.branchId,
    aggregateType: "FinanceReceivable", aggregateId: event.receivableId, occurredAt: event.occurredAt, actorId: "system", actorName: "Finance",
    payload: { receivableId: event.receivableId, customerId: event.customerId, balance: event.balance, daysOverdue: event.daysOverdue, sourceCode: event.sourceCode },
  }),
  async updateReminderCache(scope, id, values) { await ReceivableModel.updateOne({ ...scope, _id: id, status: { $in: ["open", "partially_paid"] }, balance: { $gt: 0 } }, { $set: { daysOverdue: values.daysOverdue, lastReminderAt: values.lastReminderAt }, $inc: { reminderCount: 1 } }); },
};

export const OverdueReminderService = createOverdueReminderService(mongoDependencies);

export function retryReminderDelivery(id: string, now = new Date(), scope?: FinanceBranchScope) {
  return retryReminderDeliveryWith(id, now, {
    claim: (deliveryId) => ReminderDeliveryModel.findOneAndUpdate(
      { _id: deliveryId, ...(scope || {}), status: "failed", failureType: "temporary", $expr: { $lt: ["$attempt", "$maxAttempts"] } },
      { $set: { status: "sending" }, $inc: { attempt: 1 } }, { new: true },
    ).lean(),
    send: (delivery) => delivery.channel === "in_app"
      ? mongoDependencies.createNotification({ ...delivery.payload, companyCode: delivery.companyCode, branchId: delivery.branchId, idempotencyKey: delivery.cycleKey })
      : mongoDependencies.publishOverdue({ ...delivery.payload, companyCode: delivery.companyCode, branchId: delivery.branchId, eventId: delivery.cycleKey, occurredAt: now }),
    async update(deliveryId, values) {
      const set = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
      const unset = Object.fromEntries(Object.entries(values).filter(([, value]) => value === undefined).map(([key]) => [key, 1]));
      await ReminderDeliveryModel.updateOne({ _id: deliveryId }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    },
  });
}

export async function runOverdueScansForAllScopes(now = new Date()) {
  const scopes = await ReceivableModel.aggregate<{ _id: FinanceBranchScope }>([
    { $match: { status: { $in: ["open", "partially_paid"] }, balance: { $gt: 0 } } },
    { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId" } } },
  ]);
  await Promise.all(scopes.map(({ _id }) => OverdueReminderService.runOverdueScan(_id, "scheduled", undefined, now)));
}
