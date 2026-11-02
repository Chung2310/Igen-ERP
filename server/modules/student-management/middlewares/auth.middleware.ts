import { Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../../../middleware/auth";
import { requireStudentBranch } from "../utils/auth.util";

type StudentManagementRole = "superadmin" | "admin" | "branch_owner" | "manager" | "user" | "teacher";

export function requiresAssignedStudentBranch(role: string, branchId?: string, allowUnassignedAdmin = false) {
  return ["admin", "manager", "branch_owner"].includes(role) && !branchId
    && !(allowUnassignedAdmin && role === "admin");
}

export interface AuthRequest extends AuthenticatedRequest {
  user?: {
    uid: string;
    id: string;
    email: string;
    role: StudentManagementRole;
    centerId: string;
    companyCode?: string;
    branchId?: string;
  };
}

function authenticateStudentRequest(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  options: { unassignedAdminOnly?: boolean; allowUnassignedAdmin?: boolean } = {},
) {
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

    if (options.unassignedAdminOnly) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Chỉ quản trị viên được xử lý dữ liệu chưa gán chi nhánh." });
      }
      return next();
    }

    if (requiresAssignedStudentBranch(req.user.role, req.user.branchId, options.allowUnassignedAdmin)) {
      try {
        requireStudentBranch(req.user);
      } catch (error) {
        return res.status(400).json({ success: false, error: (error as Error).message });
      }
    }

    next();
  });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  return authenticateStudentRequest(req, res, next);
}

export function adminUnassignedAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  return authenticateStudentRequest(req, res, next, { unassignedAdminOnly: true });
}

/** Partner records are company-owned; only branch-level commission settings need a selected branch. */
export function partnerAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  return authenticateStudentRequest(req, res, next, { allowUnassignedAdmin: true });
}
export function requireRoles(...roles: StudentManagementRole[]) {
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
