import type { NextFunction, Response } from "express";
import { UserModel } from "../model/user.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import type { AuthenticatedRequest } from "./auth";

export function createSuperAdminMiddleware(deps: any) {
  return {
    async requireRealSuperAdmin(req: any, res: Response, next: NextFunction) {
      const actor = req.user?.id ? await deps.users.find(req.user.id) : null;
      if (!actor || actor.role !== "superadmin") return res.status(403).json({ status: "error", message: "Super Admin access required" });
      req.realActor = actor; return next();
    },
    async requirePrivilegedSession(req: any, res: Response, next: NextFunction) {
      const sid = req.user?.sessionId; if (!sid) return res.status(401).json({ status: "error", message: "Privileged session required" });
      const session = await deps.sessions.find(sid);
      const idleExpired = session?.lastSeenAt && deps.now().getTime() - new Date(session.lastSeenAt).getTime() > 30 * 60_000;
      if (!session || session.revokedAt || idleExpired || new Date(session.expiresAt) <= deps.now() || String(session.userId) !== String(req.user.id)) return res.status(401).json({ status: "error", message: "Privileged session expired or revoked" });
      if (session.lastSeenAt && deps.now().getTime() - new Date(session.lastSeenAt).getTime() > 5 * 60_000 && deps.sessions.save) { session.lastSeenAt = deps.now(); await deps.sessions.save(session); }
      req.privilegedSession = session; return next();
    },
  };
}

const middleware = createSuperAdminMiddleware({
  users: { find: (id: string) => UserModel.findById(id).select("role email companyCode") },
  sessions: { find: (sid: string) => SuperAdminSessionModel.findOne({ sessionId: sid }), save: (session: any) => session.save() }, now: () => new Date(),
});
export const requireRealSuperAdmin = middleware.requireRealSuperAdmin;
export const requirePrivilegedSession = middleware.requirePrivilegedSession;

export interface SuperAdminRequest extends AuthenticatedRequest { realActor?: any; privilegedSession?: any; }
