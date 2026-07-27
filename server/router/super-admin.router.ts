import { Router } from "express";
import { getDeploymentEnv } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { requirePrivilegedSession, requireRealSuperAdmin } from "../middleware/super-admin-auth";
import { superAdminAuthService } from "../service/super-admin-auth.service";
import { createTenantRouter } from "./super-admin-tenant.router";
import { superAdminUserAccessRouter } from "./super-admin-user-access.router";
import { superAdminController } from "../controller/super-admin.controller";
import { superAdminAccountService } from "../service/super-admin-account.service";
import { validateRequest } from "../middleware/validation";
import { getSuperAdminRequestMetadata } from "../security/super-admin-request-context";
import {
  getAuditEventsSchema,
  getDashboardSummarySchema,
  revokeSessionSchema,
  startEnrollmentSchema,
  confirmEnrollmentSchema,
  verifyTotpSchema,
  verifyRecoverySchema,
  createSuperAdminSchema,
} from "../validation/super-admin.validation";

export const superAdminRouter = Router();
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, maxAge: 8 * 60 * 60_000 };

superAdminRouter.post(
  "/auth/enrollment/start",
  validateRequest(startEnrollmentSchema),
  async (req, res) => {
    try {
      return res.json(await superAdminAuthService.beginEnrollment(req.body.challengeId, getSuperAdminRequestMetadata(req)));
    } catch (e) {
      return res.status(401).json({ status: "error", message: (e as Error).message });
    }
  }
);

superAdminRouter.post(
  "/auth/enrollment/confirm",
  validateRequest(confirmEnrollmentSchema),
  async (req, res) => {
    try {
      const result = await superAdminAuthService.confirmEnrollment(req.body.challengeId, req.body.token, getSuperAdminRequestMetadata(req));
      res.cookie("refreshToken", result.refreshToken, cookie);
      return res.json(result);
    } catch (e) {
      return res.status(401).json({ status: "error", message: (e as Error).message });
    }
  }
);

superAdminRouter.post(
  "/auth/totp/verify",
  validateRequest(verifyTotpSchema),
  async (req, res) => {
    try {
      const result = await superAdminAuthService.completeTotpLogin(req.body.challengeId, req.body.token, getSuperAdminRequestMetadata(req));
      res.cookie("refreshToken", result.refreshToken, cookie);
      return res.json(result);
    } catch (e) {
      return res.status(401).json({ status: "error", message: (e as Error).message });
    }
  }
);

superAdminRouter.post(
  "/auth/recovery/verify",
  validateRequest(verifyRecoverySchema),
  async (req, res) => {
    try {
      const result = await superAdminAuthService.completeRecoveryLogin(req.body.challengeId, req.body.code, getSuperAdminRequestMetadata(req));
      res.cookie("refreshToken", result.refreshToken, cookie);
      return res.json(result);
    } catch (e) {
      return res.status(401).json({ status: "error", message: (e as Error).message });
    }
  }
);

superAdminRouter.use(requireAuth as any, requireRealSuperAdmin as any, requirePrivilegedSession as any);
superAdminRouter.get("/environment", (_req, res) => res.json({ environment: getDeploymentEnv() }));
superAdminRouter.get("/admins", async (_req, res) => res.json({ admins: await superAdminAccountService.list() }));
superAdminRouter.post("/admins", validateRequest(createSuperAdminSchema), async (req: any, res) => {
  try {
    return res.status(201).json({ admin: await superAdminAccountService.create(req.body, req.user.id) });
  } catch (error: any) {
    const status = error.statusCode || (error.code === 11000 ? 409 : 500);
    return res.status(status).json({ status: "error", message: status === 409 ? "Email đã được sử dụng." : error.message || "Không thể tạo Super Admin." });
  }
});
superAdminRouter.use(createTenantRouter());
superAdminRouter.use("/", superAdminUserAccessRouter);
superAdminRouter.get("/auth/sessions", async (req: any, res) => res.json({ sessions: await superAdminAuthService.listSessions(req.user.id) }));

superAdminRouter.delete(
  "/auth/sessions/:sessionId",
  validateRequest(revokeSessionSchema),
  async (req, res) => res.json({ revoked: await superAdminAuthService.revokeSession(req.params.sessionId) })
);

superAdminRouter.post("/auth/logout", async (req: any, res) => {
  await superAdminAuthService.revokeSession(req.user.sessionId, "logout");
  res.clearCookie("refreshToken");
  return res.json({ status: "ok" });
});

// Dashboard & Audit endpoints
superAdminRouter.get(
  "/dashboard/summary",
  validateRequest(getDashboardSummarySchema),
  superAdminController.getDashboardSummary as any
);

superAdminRouter.get(
  "/audit/events",
  validateRequest(getAuditEventsSchema),
  superAdminController.getAuditEvents as any
);
