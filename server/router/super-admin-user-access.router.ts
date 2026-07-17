import { Router } from "express";
import { userAccessManagementService } from "../super-admin/user-access-management.service";
import { executeAdminAction } from "../super-admin/action-runtime";
import { getAdminAction } from "../super-admin/action-registry";

export const superAdminUserAccessRouter = Router();
const tenant = (req: any) => { const query = req.query.tenantId; const body = req.body?.tenantId; if (!query || (body && String(query) !== String(body))) throw new Error("tenantId must be explicit and match when supplied in body"); return String(query); };
superAdminUserAccessRouter.get("/users", async (req: any, res) => {
  if (!tenant(req)) return res.status(400).json({ message: "tenantId is required" });
  return res.json(await userAccessManagementService.search({ tenantId: tenant(req), page: Number(req.query.page) || 1, limit: Math.min(Number(req.query.limit) || 20, 100), q: req.query.q }));
});
superAdminUserAccessRouter.get("/users/:userId", async (req: any, res) => res.json(await userAccessManagementService.detail({ tenantId: tenant(req), userId: req.params.userId })));
for (const [path, method] of [["/users/:userId/lock", "lock"], ["/users/:userId/unlock", "unlock"], ["/users/:userId/sessions/revoke", "revokeSessions"], ["/users/:userId/2fa/reset", "resetTwoFactor"], ["/users/:userId/role", "assignRole"], ["/users/:userId/impersonation", "startImpersonation"]] as const) superAdminUserAccessRouter.post(path, async (req: any, res) => { try { const result = await (userAccessManagementService as any)[method]({ ...req.body, tenantId: tenant(req), userId: req.params.userId, actorId: req.realActor?._id }); return res.json({ ...result, actionId: `access:${Date.now()}` }); } catch (e) { return res.status(400).json({ message: (e as Error).message }); } });
