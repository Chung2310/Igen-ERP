import { Router, type RequestHandler, type Response } from "express";
import Joi from "joi";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { requirePrivilegedSession, requireRealSuperAdmin } from "../middleware/super-admin-auth";
import { validateRequest } from "../middleware/validation";
import { executeSubscriptionAction } from "../super-admin/subscription-action";
import { registerAdminAction } from "../super-admin/action-registry";
import { AiSubscriptionPlanModel } from "../modules/marketing-suite/shared/model/ai-subscription.model";
import { aiSubscriptionService } from "../modules/marketing-suite/shared/service/ai-subscription.service";

const action = (type: string) => registerAdminAction({ type, risk: "sensitive", requiresReason: true,
  requiresStepUp: false, parse: (input: unknown) => input });
const actions = { savePlan: action("ai.subscription.plan.save"), assign: action("ai.subscription.assign"), cancel: action("ai.subscription.cancel") };
const reason = Joi.string().trim().min(3).max(500).required();
const objectId = Joi.string().hex().length(24).required();
const plan = Joi.object({ code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(40).required(),
  name: Joi.string().trim().min(1).max(120).required(), description: Joi.string().trim().max(1000).allow("").default(""),
  durationDays: Joi.number().integer().min(1).max(3660).required(), aiLimit: Joi.number().integer().min(1).max(10_000_000).required(),
  priceVnd: Joi.number().integer().min(0).max(1_000_000_000).required(),
  active: Joi.boolean().required(), reason, updatedAt: Joi.date().iso().optional() });
const headers = Joi.object({ "idempotency-key": Joi.string().guid().required() }).unknown(true);
const idempotency: RequestHandler = (req, res, next) => {
  const { error } = headers.validate(req.headers);
  if (error) return void res.status(400).json({ message: "Thiếu idempotency-key hợp lệ." });
  next();
};
const companyParams = Joi.object({ companyCode: Joi.string().trim().uppercase().max(100).required() });
function actionError(res: Response, error: unknown) {
  const cause = error as { code?: string | number; statusCode?: number; message?: string };
  const status = cause.code === 11000 ? 409 : cause.statusCode || 400;
  res.status(status).json({ message: cause.message || "Không thể hoàn tất thao tác.", code: cause.code === 11000 ? "AI_SUBSCRIPTION_CONFLICT" : cause.code });
}
function notifySubscription(companyCode: string) {
  void import("../socket").then(({ emitToCompany }) => {
    emitToCompany(companyCode, "ai-subscription:updated", { companyCode });
  }).catch(() => console.warn("[AI subscription] Live update unavailable; clients will refresh on reconnect."));
}
export const superAdminAiSubscriptionRouter = Router();
superAdminAiSubscriptionRouter.use(["/ai-subscription", "/tenants/:companyCode/ai-subscription"], requireAuth, requireRealSuperAdmin, requirePrivilegedSession, requirePermission("access:manage"));
superAdminAiSubscriptionRouter.get("/ai-subscription/plans", async (_req, res, next) => {
  try { res.json({ plans: await AiSubscriptionPlanModel.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); }
});
superAdminAiSubscriptionRouter.get("/tenants/:companyCode/ai-subscription", validateRequest({ params: companyParams }), async (req, res, next) => {
  try { res.json({ subscription: await aiSubscriptionService.summary(req.params.companyCode) }); } catch (error) { next(error); }
});

superAdminAiSubscriptionRouter.post("/ai-subscription/plans", idempotency, validateRequest({ body: plan }), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason: note, ...data } = req.body;
    delete data.updatedAt;
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.savePlan, input: data, reason: note, idempotencyKey: String(req.headers["idempotency-key"]),
    }, async (_input, session) => (await AiSubscriptionPlanModel.create([{ ...data, createdBy: req.user!.id }], { session }))[0]);
    res.status(201).json(result);
  } catch (error) { actionError(res, error); }
});
superAdminAiSubscriptionRouter.put("/ai-subscription/plans/:id", idempotency, validateRequest({ params: Joi.object({ id: objectId }), body: plan.fork("updatedAt", (field) => field.required()) }), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason: note, updatedAt, ...data } = req.body;
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.savePlan, input: { id: req.params.id, updatedAt, ...data }, reason: note, idempotencyKey: String(req.headers["idempotency-key"]),
    }, async (_input, session) => {
      const value = await AiSubscriptionPlanModel.findOneAndUpdate({ _id: req.params.id, updatedAt }, { $set: data }, { returnDocument: "after", runValidators: true, session });
      if (!value) throw Object.assign(new Error("Gói đã thay đổi. Hãy tải lại trước khi lưu."), { statusCode: 409 });
      return value;
    });
    res.json(result);
  } catch (error) { actionError(res, error); }
});
superAdminAiSubscriptionRouter.post("/tenants/:companyCode/ai-subscription", idempotency, validateRequest({ params: companyParams, body: Joi.object({ planId: objectId, reason, expectedSubscriptionId: objectId.allow(null), planUpdatedAt: Joi.date().iso().required() }) }), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.assign, input: { companyCode: req.params.companyCode, planId: req.body.planId, expectedSubscriptionId: req.body.expectedSubscriptionId, planUpdatedAt: req.body.planUpdatedAt }, reason: req.body.reason,
      idempotencyKey: String(req.headers["idempotency-key"]),
    }, (input, session) => aiSubscriptionService.assign(input.companyCode, input.planId, req.user!.id, input.expectedSubscriptionId, input.planUpdatedAt, session));
    notifySubscription(req.params.companyCode);
    res.json(result);
  } catch (error) { actionError(res, error); }
});
superAdminAiSubscriptionRouter.delete("/tenants/:companyCode/ai-subscription", idempotency, validateRequest({ params: companyParams, body: Joi.object({ reason, subscriptionId: objectId }) }), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeSubscriptionAction({ actorId: req.user!.id }, {
      definition: actions.cancel, input: { companyCode: req.params.companyCode, subscriptionId: req.body.subscriptionId }, reason: req.body.reason,
      idempotencyKey: String(req.headers["idempotency-key"]),
    }, (input, session) => aiSubscriptionService.cancel(input.companyCode, input.subscriptionId, session));
    notifySubscription(req.params.companyCode);
    res.json(result);
  } catch (error) { actionError(res, error); }
});
