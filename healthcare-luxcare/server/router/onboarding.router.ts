import { AI_CREDITS_ENABLED } from "../../shared/features";
import { freeAiEnabled } from "../service/free-ai.service";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import Joi from "joi";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { authRateLimiter } from "../middleware/rate-limit";
import {
  onboardingService,
  isPublicRegistrationEnabled,
  isInvitationRegistrationEnabled,
  MODULE_KEYS,
} from "../service/onboarding.service";
import {
  CompanyApplicationModel,
  CompanyInvitationModel,
  AccountDeletionRequestModel,
} from "../model/onboarding.model";
import { UserModel } from "../model/user.model";
import { executeAdminAction } from "../super-admin/action-runtime";
import { registerAdminAction } from "../super-admin/action-registry";

const objectId = Joi.string().hex().length(24).required();
const application = Joi.object({
  companyName: Joi.string().trim().min(2).max(160).required(),
  taxCode: Joi.string().trim().max(32).allow("").default(""),
  address: Joi.string().trim().min(5).max(400).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[0-9 ()-]{8,20}$/)
    .required(),
  businessType: Joi.string().valid("service", "recruitment", "general").required(),
  purpose: Joi.string().trim().min(20).max(2000).required(),
  revision: Joi.number().integer().min(1),
}).unknown(false);
const handler = (fn: (req: any) => Promise<any>) => async (req: any, res: any) => {
  try {
    return res.json({ status: "success", data: await fn(req) });
  } catch (error: any) {
    const status = error.code === 11000 ? 409 : error.statusCode || (error.name === "CastError" ? 400 : 500);
    const code = typeof error.code === "string" ? error.code : "ONBOARDING_ERROR";
    const message =
      status === 500
        ? "Không thể hoàn tất thao tác. Vui lòng thử lại."
        : status === 409 && error.code === 11000
          ? "Dữ liệu đã tồn tại. Hãy tải lại trạng thái."
          : error.message;
    return res.status(status).json({
      ok: false,
      status: "error",
      code,
      message,
      error: {
        code,
        message,
        requestId: String(req.id || req.requestId || res.getHeader("x-request-id") || randomUUID()),
      },
    });
  }
};
export const onboardingRouter = Router();
onboardingRouter.get("/capabilities", async (_req, res) => {
  const personalAiEnabled = false;
  const personalAiDisclosure = null;
  return res.json({
    registrationEnabled: isPublicRegistrationEnabled(),
    invitationRegistrationEnabled: isInvitationRegistrationEnabled(),
    accessModel: "organization_only",
    personalAiEnabled,
    aiQuotaEnabled: freeAiEnabled(),
    companyWalletEnabled: AI_CREDITS_ENABLED && process.env.AI_COMPANY_WALLET_ENABLED === "true",
    personalAiDisclosure,
  });
});
onboardingRouter.use(requireAuth as any);
onboardingRouter.get(
  "/state",
  handler((req) => onboardingService.state(req.user.id)),
);
onboardingRouter.post(
  "/email/resend",
  authRateLimiter,
  handler((req) => onboardingService.resendCode(req.user.id)),
);
onboardingRouter.post(
  "/email/verify",
  authRateLimiter,
  validateRequest({
    body: Joi.object({
      code: Joi.string()
        .pattern(/^\d{6}$/)
        .required(),
    }),
  }),
  handler((req) => onboardingService.verify(req.user.id, req.body.code)),
);
onboardingRouter.post(
  "/applications",
  authRateLimiter,
  validateRequest({ body: application }),
  handler((req) => onboardingService.submit(req.user.id, req.body)),
);
onboardingRouter.patch(
  "/applications/:id",
  validateRequest({ params: Joi.object({ id: objectId }), body: application }),
  handler((req) => onboardingService.submit(req.user.id, req.body, req.params.id, req.body.revision)),
);
onboardingRouter.post(
  "/applications/:id/cancel",
  validateRequest({ params: Joi.object({ id: objectId }) }),
  handler((req) => onboardingService.cancel(req.user.id, req.params.id)),
);
onboardingRouter.post(
  "/invitations/:id/answer",
  validateRequest({ params: Joi.object({ id: objectId }), body: Joi.object({ accept: Joi.boolean().required() }) }),
  handler((req) => onboardingService.answerInvite(req.user.id, req.params.id, req.body.accept)),
);
onboardingRouter.post(
  "/deletion/cancel",
  handler((req) => onboardingService.cancelDeletion(req.user.id)),
);

export const companyInvitationsRouter = Router();
companyInvitationsRouter.use(requireAuth as any, requireRole(["admin"]));
companyInvitationsRouter.get(
  "/",
  handler(async (req) => {
    await CompanyInvitationModel.updateMany(
      { companyCode: req.user.companyCode, active: true, expiresAt: { $lte: new Date() } },
      { $set: { active: false, status: "expired" } },
    );
    return CompanyInvitationModel.find({ companyCode: req.user.companyCode }).sort({ createdAt: -1 }).limit(100).lean();
  }),
);
companyInvitationsRouter.post(
  "/",
  authRateLimiter,
  validateRequest({
    body: Joi.object({
      email: Joi.string().trim().lowercase().email().max(254).required(),
      branchId: objectId,
    }),
  }),
  handler((req) => onboardingService.invite(req.user.id, req.user.companyCode, req.body.email, req.body.branchId)),
);
companyInvitationsRouter.post(
  "/:id/resend",
  authRateLimiter,
  validateRequest({ params: Joi.object({ id: objectId }) }),
  handler((req) => onboardingService.resendInvitation(req.user.id, req.user.companyCode, req.params.id)),
);
companyInvitationsRouter.post(
  "/:id/revoke",
  validateRequest({ params: Joi.object({ id: objectId }) }),
  handler((req) => onboardingService.revoke(req.user.id, req.user.companyCode, req.params.id)),
);

const reviewAction = registerAdminAction({
  type: "onboarding.application.review",
  risk: "sensitive",
  requiresReason: true,
  requiresStepUp: false,
  parse: (input: any) => input,
});
const deletionAction = registerAdminAction({
  type: "onboarding.account.delete",
  risk: "dangerous",
  requiresReason: true,
  requiresStepUp: true,
  parse: (input: any) => input,
});
// Mounted only after requireRealSuperAdmin + requirePrivilegedSession.
export const onboardingReviewRouter = Router();
onboardingReviewRouter.use((req, res, next) => {
  if (req.method !== "GET" && !/^[a-zA-Z0-9_-]{16,100}$/.test(req.header("idempotency-key") || ""))
    return res.status(400).json({ status: "error", message: "Thiếu khóa chống trùng lặp hợp lệ." });
  next();
});
onboardingReviewRouter.get(
  "/company-applications",
  handler(async (req) => {
    const applications = await CompanyApplicationModel.find(
      req.query.status ? { status: String(req.query.status) } : {},
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return Promise.all(
      applications.map(async (application: any) => {
        const user = await UserModel.findById(application.userId).select("role companyCode").lean();
        return { ...application, workspaceCode: user?.role === "trial_user" ? user.companyCode : undefined };
      }),
    );
  }),
);
onboardingReviewRouter.post(
  "/company-applications/:id/review",
  validateRequest({
    params: Joi.object({ id: objectId }),
    body: Joi.object({
      decision: Joi.string().valid("approved", "rejected", "needs_information").required(),
      revision: Joi.number().integer().min(1).required(),
      companyCode: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z][A-Z0-9_-]{2,31}$/)
        .when("decision", { is: "approved", then: Joi.required() }),
      enabledModules: Joi.array()
        .items(Joi.string().valid(...MODULE_KEYS))
        .unique()
        .min(1)
        .when("decision", { is: "approved", then: Joi.required() }),
      note: Joi.string().trim().min(5).max(2000).required(),
      reason: Joi.string().trim().min(5).max(2000).required(),
    }),
  }),
  handler((req) =>
    executeAdminAction(
      { actorId: req.user.id, sessionId: req.user.sessionId },
      {
        definition: reviewAction,
        input: { ...req.body, id: req.params.id },
        idempotencyKey: req.header("idempotency-key"),
        reason: req.body.reason,
      },
      async (input) => {
        const result = await onboardingService.review(req.user.id, input.id, input);
        return {
          applicationId: String(result._id),
          status: result.status,
          revision: result.revision,
          companyCode: result.companyCode,
        };
      },
    ),
  ),
);
onboardingReviewRouter.get(
  "/account-deletion-requests",
  handler(() => AccountDeletionRequestModel.find({ active: true }).sort({ dueAt: 1 }).limit(100).lean()),
);
onboardingReviewRouter.post(
  "/account-deletion-requests/:id/complete",
  validateRequest({
    params: Joi.object({ id: objectId }),
    body: Joi.object({
      reason: Joi.string().trim().min(5).max(2000).required(),
      password: Joi.string().required(),
      token: Joi.string()
        .pattern(/^\d{6}$/)
        .required(),
      step: Joi.number().integer().required(),
    }),
  }),
  handler((req) =>
    executeAdminAction(
      { actorId: req.user.id, sessionId: req.user.sessionId },
      {
        definition: deletionAction,
        input: { id: req.params.id },
        idempotencyKey: req.header("idempotency-key"),
        reason: req.body.reason,
        password: req.body.password,
        token: req.body.token,
        step: req.body.step,
      },
      (input) => onboardingService.completeDeletion(req.user.id, input.id),
    ),
  ),
);
