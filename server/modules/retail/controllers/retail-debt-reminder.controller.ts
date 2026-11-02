import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailDebtReminderRunModel } from "../models/retail-debt-reminder-run.model";
import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";
import { RetailDebtReminderService } from "../services/retail-debt-reminder.service";
import { RetailDebtReminderAssistantService } from "../services/retail-debt-reminder-assistant.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
export const retailDebtReminderController = {
  listRuns: handle(async (req) => { const scoped = scope(req), page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20)); const [items, total] = await Promise.all([RetailDebtReminderRunModel.find(scoped).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RetailDebtReminderRunModel.countDocuments(scoped)]); return { items, total, page, limit }; }),
  getRun: handle(async (req) => { const scoped = scope(req), run: any = await RetailDebtReminderRunModel.findOne({ _id: req.params.id, ...scoped }).lean(); if (!run) throw Object.assign(new Error("Không tìm thấy lần chạy."), { status: 404 }); return { run, deliveries: await RetailDebtReminderDeliveryModel.find({ runId: run._id, ...scoped }).sort({ createdAt: 1 }).lean() }; }),
  listRetryable: handle((req) => RetailDebtReminderAssistantService.listRetryable(scope(req), req.query)),
  runNow: handle((req) => RetailDebtReminderService.run(scope(req), new Date())),
  retry: handle((req) => RetailDebtReminderAssistantService.retry(scope(req), req.params.id, new Date())),
};
