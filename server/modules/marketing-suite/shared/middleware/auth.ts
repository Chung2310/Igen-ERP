import type { NextFunction, Response } from "express";
import { requireAuth as erpRequireAuth, requirePermission as erpRequirePermission, requireRole, requireCompanyAccess, requireHierarchyAccess } from "../../../../middleware/auth";
import type { AuthenticatedRequest } from "../../../../middleware/auth";

export type { AuthenticatedRequest };
export { requireRole, requireCompanyAccess, requireHierarchyAccess };
export { DEFAULT_ROLE_LEVELS } from "../../../../middleware/auth";

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return erpRequireAuth(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (!req.user?.companyCode) return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp." });
    return next();
  });
}

/** Translate source permissions at the boundary; ERP remains the authority. */
export function requirePermission(permission: string | string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const translate = (value: string) => {
      if (value === "marketing:post") return req.method === "GET" ? "marketing:read" : "marketing:manage";
      if (value.startsWith("user:")) return value.replace("user:", "access:");
      return value;
    };
    const mapped = Array.isArray(permission) ? permission.map(translate) : translate(permission);
    return erpRequirePermission(mapped)(req, res, next);
  };
}
