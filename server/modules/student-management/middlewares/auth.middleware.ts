import { Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../../middleware/auth";
import { requireStudentBranch } from "../utils/auth.util";

export interface AuthRequest extends AuthenticatedRequest {
  user?: {
    uid: string;
    id: string;
    email: string;
    role: "superadmin" | "admin" | "manager" | "user";
    centerId: string;
    companyCode?: string;
    branchId?: string;
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
      branchId: erpUser.branchId,
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.user.role === "admin" && !req.user.branchId) {
      try {
        requireStudentBranch(req.user);
      } catch (error) {
        return res.status(400).json({ success: false, error: (error as Error).message });
      }
    }

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
