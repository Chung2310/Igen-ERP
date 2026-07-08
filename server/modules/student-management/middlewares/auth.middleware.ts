import { Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../../middleware/auth";

export interface AuthRequest extends AuthenticatedRequest {
  user?: {
    uid: string;
    id: string;
    email: string;
    role: "superadmin" | "admin" | "manager" | "user";
    centerId: string;
    companyCode?: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req as unknown as AuthenticatedRequest, res, () => {
    const erpUser = (req as unknown as AuthenticatedRequest).user;
    if (!erpUser) {
      return res.status(401).json({ success: false, error: "Không tìm thấy token xác thực." });
    }

    req.user = {
      uid: erpUser.id,
      id: erpUser.id,
      email: erpUser.email,
      role: erpUser.role as AuthRequest["user"]["role"],
      centerId: erpUser.companyCode || "SYSTEM",
      companyCode: erpUser.companyCode,
    };
    next();
  });
}

export function requireRoles(...roles: Array<"superadmin" | "admin" | "manager" | "user">) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Chưa xác thực." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Bạn không có quyền truy cập." });
    }

    next();
  };
}
