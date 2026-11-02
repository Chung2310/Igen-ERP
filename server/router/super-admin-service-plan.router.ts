import { Router, type Response } from "express";
import Joi from "joi";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { requireRealSuperAdmin, requirePrivilegedSession } from "../middleware/super-admin-auth";
import { validateRequest } from "../middleware/validation";
import { MODULE_KEYS } from "../config/module-keys";
import { ServicePlanModel } from "../model/service-plan.model";
import { servicePlanService } from "../service/service-plan.service";
import { executeSubscriptionAction } from "../super-admin/subscription-action";
import { registerAdminAction } from "../super-admin/action-registry";
import { clearModuleCache } from "../middleware/require-module";
import { notifyCompanyModulesChanged } from "../service/company-module-notify";

const action = (type: string) => registerAdminAction({ type, risk: "sensitive", requiresReason: true, requiresStepUp: false, parse: (input: unknown) => input });
const actions = { save: action("service.plan.save"), assign: action("service.plan.assign"), cancel: action("service.plan.cancel") };
const objectId = Joi.string().hex().length(24).required();
const reason = Joi.string().trim().min(3).max(500).required();
const plan = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(40).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(1000).allow("").default(""),
  priceVnd: Joi.number().integer().min(0).max(1_000_000_000).required(),
  durationDays: Joi.number().integer().min(1).max(3660).required(),
  modules: Joi.array().items(Joi.string().valid(...MODULE_KEYS)).min(1).unique().required(),
  active: Joi.boolean().required(), updatedAt: Joi.date().iso().optional(), reason,
});
const companyParams = Joi.object({ companyCode: Joi.string().trim().uppercase().max(100).required() });
const key = (req: AuthenticatedRequest) => {
  const value = String(req.headers["idempotency-key"] || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw Object.assign(new Error("Thiếu idempotency-key hợp lệ."), { statusCode: 400 });
  return value;
};
function failure(res: Response, error: unknown) {
  const cause = error as { code?: string | number; statusCode?: number; message?: string };
  res.status(cause.code === 11000 ? 409 : cause.statusCode || 400).json({ message: cause.message || "Không thể hoàn tất thao tác.", code: cause.code });
}
async function notify(companyCode: string, modules: string[]) {
  try {
    const socket = await import("../socket");
    await notifyCompanyModulesChanged(companyCode, modules, { clearModuleCache, emitToCompany: socket.emitToCompany }, "service plan");
  } catch { clearModuleCache(companyCode); }
}
export const superAdminServicePlanRouter = Router();
superAdminServicePlanRouter.use(requireAuth, requireRealSuperAdmin, requirePrivilegedSession, requirePermission("access:manage"));
superAdminServicePlanRouter.get("/service-plans", async (_req, res, next) => {
  try { res.json({ plans: await ServicePlanModel.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); }
});
superAdminServicePlanRouter.get("/tenants/:companyCode/service-plan", validateRequest({ params: companyParams }), async (req, res, next) => {
  try { res.json({ subscription: await servicePlanService.current(req.params.companyCode) }); } catch (error) { next(error); }
});
superAdminServicePlanRouter.post("/service-plans", validateRequest({ body: plan }), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason: note, updatedAt, ...data } = req.body;
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.save, input: data, reason: note, idempotencyKey: key(req),
    }, async (_input, session) => (await ServicePlanModel.create([{ ...data, createdBy: req.user!.id }], { session }))[0]);
    res.status(201).json(result);
  } catch (error) { failure(res, error); }
});
superAdminServicePlanRouter.put("/service-plans/:id", validateRequest({ params: Joi.object({ id: objectId }), body: plan.fork("updatedAt", field => field.required()) }), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason: note, updatedAt, ...data } = req.body;
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.save, input: { id: req.params.id, updatedAt, ...data }, reason: note, idempotencyKey: key(req),
    }, async (_input, session) => {
      const value = await ServicePlanModel.findOneAndUpdate({ _id: req.params.id, updatedAt }, { $set: data }, { returnDocument: "after", runValidators: true, session });
      if (!value) throw Object.assign(new Error("Gói đã thay đổi. Hãy tải lại."), { statusCode: 409 });
      return value;
    });
    res.json(result);
  } catch (error) { failure(res, error); }
});
superAdminServicePlanRouter.post("/tenants/:companyCode/service-plan", validateRequest({
  params: companyParams, body: Joi.object({ planId: objectId, reason, expectedStartsAt: Joi.date().iso().allow(null).required(), planUpdatedAt: Joi.date().iso().required() }),
}), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.assign, input: { companyCode: req.params.companyCode, planId: req.body.planId, expectedStartsAt: req.body.expectedStartsAt ? new Date(req.body.expectedStartsAt).toISOString() : null, planUpdatedAt: req.body.planUpdatedAt },
      reason: req.body.reason, idempotencyKey: key(req),
    }, (input, session) => servicePlanService.assign(input.companyCode, input.planId, req.user!.id, input.expectedStartsAt, input.planUpdatedAt, session));
    await notify(req.params.companyCode, result.result.modules);
    res.json(result);
  } catch (error) { failure(res, error); }
});
superAdminServicePlanRouter.delete("/tenants/:companyCode/service-plan", validateRequest({
  params: companyParams, body: Joi.object({ reason, expectedStartsAt: Joi.date().iso().required() }),
}), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.cancel, input: { companyCode: req.params.companyCode, expectedStartsAt: new Date(req.body.expectedStartsAt).toISOString() },
      reason: req.body.reason, idempotencyKey: key(req),
    }, (input, session) => servicePlanService.cancel(input.companyCode, input.expectedStartsAt, session));
    await notify(req.params.companyCode, []);
    res.json(result);
  } catch (error) { failure(res, error); }
});
