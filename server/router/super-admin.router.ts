import { Router } from "express";
import { getDeploymentEnv } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { requirePrivilegedSession, requireRealSuperAdmin } from "../middleware/super-admin-auth";
import { superAdminAuthService } from "../service/super-admin-auth.service";
import { superAdminController } from "../controller/super-admin.controller";
import { validateRequest } from "../middleware/validation";
import {
  getAuditEventsSchema,
  getDashboardSummarySchema,
  revokeSessionSchema,
  startEnrollmentSchema,
  confirmEnrollmentSchema,
  verifyTotpSchema,
  verifyRecoverySchema,
} from "../validation/super-admin.validation";

export const superAdminRouter = Router();
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, maxAge: 8 * 60 * 60_000 };

superAdminRouter.post(
  "/auth/enrollment/start",
  validateRequest(startEnrollmentSchema),
  async (req, res) => {
    try {
      return res.json(await superAdminAuthService.beginEnrollment(req.body.challengeId));
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
      const result = await superAdminAuthService.confirmEnrollment(req.body.challengeId, req.body.token);
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
      const result = await superAdminAuthService.completeTotpLogin(req.body.challengeId, req.body.token);
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
      const result = await superAdminAuthService.completeRecoveryLogin(req.body.challengeId, req.body.code);
      res.cookie("refreshToken", result.refreshToken, cookie);
      return res.json(result);
    } catch (e) {
      return res.status(401).json({ status: "error", message: (e as Error).message });
    }
  }
);

superAdminRouter.use(requireAuth as any, requireRealSuperAdmin as any, requirePrivilegedSession as any);
superAdminRouter.get("/environment", (_req, res) => res.json({ environment: getDeploymentEnv() }));
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
