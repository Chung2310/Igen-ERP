import { Router } from "express";
import { getDeploymentEnv } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { requirePrivilegedSession, requireRealSuperAdmin } from "../middleware/super-admin-auth";
import { superAdminAuthService } from "../service/super-admin-auth.service";
import { superAdminUserAccessRouter } from "./super-admin-user-access.router";

export const superAdminRouter = Router();
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, maxAge: 8 * 60 * 60_000 };
const body = (req: any, fields: string[]) => fields.every((key) => typeof req.body?.[key] === "string" && req.body[key].trim());

superAdminRouter.post("/auth/enrollment/start", async (req, res) => {
  if (!body(req, ["challengeId"])) return res.status(400).json({ status: "error", message: "challengeId is required" });
  try { return res.json(await superAdminAuthService.beginEnrollment(req.body.challengeId)); } catch (e) { return res.status(401).json({ status: "error", message: (e as Error).message }); }
});
superAdminRouter.post("/auth/enrollment/confirm", async (req, res) => {
  if (!body(req, ["challengeId", "token"]) || !/^\d{6}$/.test(req.body.token)) return res.status(400).json({ status: "error", message: "A six-digit token is required" });
  try { const result = await superAdminAuthService.confirmEnrollment(req.body.challengeId, req.body.token); res.cookie("refreshToken", result.refreshToken, cookie); return res.json(result); } catch (e) { return res.status(401).json({ status: "error", message: (e as Error).message }); }
});
superAdminRouter.post("/auth/totp/verify", async (req, res) => {
  if (!body(req, ["challengeId", "token"]) || !/^\d{6}$/.test(req.body.token)) return res.status(400).json({ status: "error", message: "A six-digit token is required" });
  try { const result = await superAdminAuthService.completeTotpLogin(req.body.challengeId, req.body.token); res.cookie("refreshToken", result.refreshToken, cookie); return res.json(result); } catch (e) { return res.status(401).json({ status: "error", message: (e as Error).message }); }
});
superAdminRouter.post("/auth/recovery/verify", async (req, res) => {
  if (!body(req, ["challengeId", "code"])) return res.status(400).json({ status: "error", message: "Recovery code is required" });
  try { const result = await superAdminAuthService.completeRecoveryLogin(req.body.challengeId, req.body.code); res.cookie("refreshToken", result.refreshToken, cookie); return res.json(result); } catch (e) { return res.status(401).json({ status: "error", message: (e as Error).message }); }
});

superAdminRouter.use(requireAuth as any, requireRealSuperAdmin as any, requirePrivilegedSession as any);
superAdminRouter.get("/environment", (_req, res) => res.json({ environment: getDeploymentEnv() }));
superAdminRouter.use("/", superAdminUserAccessRouter);
superAdminRouter.get("/auth/sessions", async (req: any, res) => res.json({ sessions: await superAdminAuthService.listSessions(req.user.id) }));
superAdminRouter.delete("/auth/sessions/:sessionId", async (req, res) => res.json({ revoked: await superAdminAuthService.revokeSession(req.params.sessionId) }));
superAdminRouter.post("/auth/logout", async (req: any, res) => { await superAdminAuthService.revokeSession(req.user.sessionId, "logout"); res.clearCookie("refreshToken"); return res.json({ status: "ok" }); });
