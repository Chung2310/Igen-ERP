import { Router, type RequestHandler } from "express";
import Joi from "joi";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { requirePrivilegedSession, requireRealSuperAdmin } from "../middleware/super-admin-auth";
import { validateRequest } from "../middleware/validation";
import { executeAdminAction } from "../super-admin/action-runtime";
import { registerAdminAction } from "../super-admin/action-registry";
import { AiSubscriptionPlanModel, AiSubscriptionPeriodModel } from "../modules/marketing-suite/shared/model/ai-subscription.model";
import { aiSubscriptionService } from "../modules/marketing-suite/shared/service/ai-subscription.service";

const action = (type: string) => registerAdminAction({ type, risk: "sensitive", requiresReason: true,
  requiresStepUp: false, parse: (input: unknown) => input });
const actions = { savePlan: action("ai.subscription.plan.save"), assign: action("ai.subscription.assign"), cancel: action("ai.subscription.cancel") };
const reason = Joi.string().trim().min(3).max(500).required();
const objectId = Joi.string().hex().length(24).required();
const plan = Joi.object({ code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(40).required(),
  name: Joi.string().trim().min(1).max(120).required(), description: Joi.string().trim().max(1000).allow("").default(""),
  durationDays: Joi.number().integer().min(1).max(3660).required(), aiLimit: Joi.number().integer().min(1).max(10_000_000).required(),
  active: Joi.boolean().required(), reason, updatedAt: Joi.date().iso().optional() });
const headers = Joi.object({ "idempotency-key": Joi.string().guid().required() }).unknown(true);
const idempotency: RequestHandler = (req, res, next) => {
  const { error } = headers.validate(req.headers);
  if (error) return void res.status(400).json({ message: "Thiếu idempotency-key hợp lệ." });
  next();
};
const companyParams = Joi.object({ companyCode: Joi.string().trim().uppercase().max(100).required() });
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
    const result = await executeAdminAction({ actorId: req.user!.id, sessionId: req.user!.sessionId }, {
      definition: actions.savePlan, input: data, reason: note, idempotencyKey: String(req.headers["idempotency-key"]),
    }, async () => AiSubscriptionPlanModel.create({ ...data, createdBy: req.user!.id }));
    res.status(201).json(result);
  } catch (error) { res.status((error as { code?: number }).code === 11000 ? 409 : 400).json({ message: (error as Error).message }); }
});
superAdminAiSubscriptionRouter.put("/ai-subscription/plans/:id", idempotency, validateRequest({ params: Joi.object({ id: objectId }), body: plan.fork("updatedAt", (field) => field.required()) }), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason: note, updatedAt, ...data } = req.body;
    const result = await executeAdminAction({ actorId: req.user!.id, sessionId: req.user!.sessionId }, {
      definition: actions.savePlan, input: { id: req.params.id, updatedAt, ...data }, reason: note, idempotencyKey: String(req.headers["idempotency-key"]),
    }, async () => {
      const value = await AiSubscriptionPlanModel.findOneAndUpdate({ _id: req.params.id, updatedAt }, { $set: data }, { returnDocument: "after", runValidators: true });
      if (!value) throw new Error("Gói đã thay đổi. Hãy tải lại trước khi lưu.");
      return value;
    });
    res.json(result);
  } catch (error) { res.status(400).json({ message: (error as Error).message }); }
});
superAdminAiSubscriptionRouter.post("/tenants/:companyCode/ai-subscription", idempotency, validateRequest({ params: companyParams, body: Joi.object({ planId: objectId, reason }) }), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeAdminAction({ actorId: req.user!.id, sessionId: req.user!.sessionId }, {
      definition: actions.assign, input: { companyCode: req.params.companyCode, planId: req.body.planId }, reason: req.body.reason,
      idempotencyKey: String(req.headers["idempotency-key"]),
    }, (input) => aiSubscriptionService.assign(input.companyCode, input.planId, req.user!.id));
    res.json(result);
  } catch (error) { res.status(400).json({ message: (error as Error).message }); }
});
superAdminAiSubscriptionRouter.delete("/tenants/:companyCode/ai-subscription", idempotency, validateRequest({ params: companyParams, body: Joi.object({ reason }) }), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await executeAdminAction({ actorId: req.user!.id, sessionId: req.user!.sessionId }, {
      definition: actions.cancel, input: { companyCode: req.params.companyCode }, reason: req.body.reason,
      idempotencyKey: String(req.headers["idempotency-key"]),
    }, (input) => AiSubscriptionPeriodModel.findOneAndUpdate({ companyCode: input.companyCode, status: "active" }, { $set: { status: "cancelled" } }, { returnDocument: "after" }));
    res.json(result);
  } catch (error) { res.status(400).json({ message: (error as Error).message }); }
});
