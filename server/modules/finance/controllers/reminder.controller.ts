import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../../errors/app-error";
import { resolveFinanceScopeFromRequest, requireFinanceBranch } from "../contracts";
import { ReminderDeliveryModel } from "../models/reminder-delivery.model";
import { ReminderRunModel } from "../models/reminder-run.model";
import { ReceivableModel } from "../models/receivable.model";
import { OverdueReminderService, retryReminderDelivery } from "../services/overdue-reminder.service";
import { createRetryableFinanceReminderAssistantService } from "../services/reminder-assistant.service";

const scope = async (req: Request) => requireFinanceBranch(await resolveFinanceScopeFromRequest((req as any).user || {}, {
  companyCode: req.query?.companyCode,
  branchId: req.query?.branchId,
}));

const positiveLimit = (value: unknown) => Math.min(100, Math.max(1, Number.parseInt(String(value || "20"), 10) || 20));

export function createReminderController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); }
    catch (error) { return next(error); }
  };
  return {
    list: run(async (req) => dependencies.list(await scope(req), req.query)),
    listRetryable: run(async (req) => dependencies.listRetryable(await scope(req), req.query)),
    detail: run(async (req) => dependencies.detail(await scope(req), req.params.id)),
    run: run(async (req) => dependencies.run(await scope(req), (req as any).user || {})),
    retry: run(async (req) => dependencies.retry(await scope(req), req.params.id, (req as any).user || {})),
    retryInApp: run(async (req) => dependencies.retryInApp(await scope(req), req.params.id, (req as any).user || {})),
  };
}

const retryableFinanceReminderAssistantService = createRetryableFinanceReminderAssistantService({
  listDeliveries: (filter, skip, limit) => ReminderDeliveryModel.find(filter).sort({ nextAttemptAt: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
  countDeliveries: (filter) => ReminderDeliveryModel.countDocuments(filter),
  listReceivables: (financeScope, ids) => ReceivableModel.find({ ...financeScope, _id: { $in: ids } })
    .select("customerName receivableCode sourceCode balance daysOverdue")
    .lean(),
});

export const reminderController = createReminderController({
  async list(financeScope: any, query: any) {
    const limit = positiveLimit(query?.limit);
    return ReminderRunModel.find(financeScope).sort({ startedAt: -1 }).limit(limit).lean();
  },
  async detail(financeScope: any, id: string) {
    const reminderRun = await ReminderRunModel.findOne({ ...financeScope, _id: id }).lean();
    if (!reminderRun) throw new NotFoundError("RESOURCE_NOT_FOUND", "REMINDER_RUN_NOT_FOUND");
    const deliveries = await ReminderDeliveryModel.find({ ...financeScope, runId: id }).sort({ createdAt: 1 }).lean();
    return { ...reminderRun, deliveries };
  },
  listRetryable: (financeScope: any, query: any) => retryableFinanceReminderAssistantService.list(financeScope, query),
  run: (financeScope: any, actor: any) => OverdueReminderService.runOverdueScan(financeScope, "manual", actor),
  async retry(financeScope: any, id: string) {
    const delivery = await ReminderDeliveryModel.exists({ ...financeScope, _id: id });
    if (!delivery) throw new NotFoundError("RESOURCE_NOT_FOUND", "REMINDER_DELIVERY_NOT_FOUND");
    return retryReminderDelivery(id, new Date(), financeScope);
  },
  async retryInApp(financeScope: any, id: string) {
    const delivery = await ReminderDeliveryModel.exists({ ...financeScope, _id: id, channel: "in_app" });
    if (!delivery) throw new NotFoundError("RESOURCE_NOT_FOUND", "REMINDER_DELIVERY_NOT_FOUND");
    return retryReminderDelivery(id, new Date(), financeScope, "in_app");
  },
});
