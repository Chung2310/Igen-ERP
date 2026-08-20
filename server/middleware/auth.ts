import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { getJwtAccessSecret } from "../config/env";
import { expandEffectivePermissions, normalizeStoredPermissions } from "../config/permission-catalog";

const REGULAR_SESSION_REPLACED_CODE = "SESSION_REPLACED";
const REGULAR_SESSION_REPLACED_MESSAGE = "Phiên đăng nhập đã được sử dụng trên thiết bị khác. Vui lòng đăng nhập lại.";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyCode?: string;
    branchId?: string;
    sessionId?: string;
    authLevel?: string;
    displayName?: string;
  };
  resource?: any; // Để đính kèm tài nguyên sau khi qua requireCompanyAccess
}

function shouldSkipRoutineAuthLog(method: string, url: string) {
  const normalizedMethod = String(method || "").toUpperCase();
  const normalizedUrl = String(url || "");

  if (normalizedMethod !== "GET" && normalizedMethod !== "POST") {
    return false;
  }

  const noisyPrefixes = [
    "/api/v1/auth/telegram-link",
    "/api/v1/crud/marketing-contents",
    "/api/v1/crud/crm-tickets",
    "/api/v1/crud/products",
    "/api/v1/wallet/balance",
    "/api/v1/gemini/media-history",
  ];

  return noisyPrefixes.some((prefix) => normalizedUrl.startsWith(prefix));
}

/**
 * Danh sách mã quyền mặc định của hệ thống cho từng vai trò
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ["*"],
  admin: ["dashboard:manage", "people:manage", "relationship:manage", "hr:manage", "timekeeping:manage", "payroll-period:manage", "payroll-policy:manage", "payroll-payment:manage", "finance-wallet:manage", "finance-receivable:manage", "asset:manage", "labor-partner:manage", "labor-partner-policy:manage", "labor-partner-settlement:manage", "labor-partner-payout:manage", "work:manage", "inventory:manage", "retail:manage", "resource:manage", "chat:manage", "recruitment:manage", "settings:manage", "access:manage"],
  branch_owner: [
    "dashboard:read", "access:manage", "hr:read", "timekeeping:manage", "people:manage", "resource:read", "chat:read", "work:manage"
  ],
  manager: [
    "dashboard:read", "access:read", "work:manage", "inventory:read",
    "hr:read", "people:read", "timekeeping:read", "chat:read", "resource:read", "settings:manage"
  ],
  user: [
    "access:read", "work:manage", "inventory:read", "hr:read", "people:read", "timekeeping:read", "chat:read", "resource:read"
  ],
  // Giảng viên chỉ làm việc trong khu vực học viên. Quyền people:manage
  // được middleware kiểm tra thêm theo lớp mà tài khoản được phân công.
  teacher: ["people:manage"]
};
DEFAULT_ROLE_PERMISSIONS.admin.push("repair:manage");
// repair:read tách khỏi repair:manage nên phải cấp riêng, nếu không mọi API GET của
// module sửa chữa trả 403 kể cả với admin.
DEFAULT_ROLE_PERMISSIONS.admin.push("repair:read");
DEFAULT_ROLE_PERMISSIONS.manager.push("repair:read");
DEFAULT_ROLE_PERMISSIONS.admin.push("customer:manage");
DEFAULT_ROLE_PERMISSIONS.admin.push("marketing:manage");

/**
 * Cấp bậc mặc định của các vai trò hệ thống (Số nhỏ hơn = cấp cao hơn)
 */
export const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  superadmin: 0,
  admin: 1,
  branch_owner: 2,
  manager: 3,
  user: 4,
  teacher: 4
};

/**
 * Middleware yêu cầu đăng nhập bằng Access Token
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = "";
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    console.warn(`[requireAuth] Từ chối truy cập ${req.method} ${req.originalUrl}: Không tìm thấy Access Token.`);
    return res.status(401).json({
      status: "error",
      message: "Yêu cầu đăng nhập. Không tìm thấy mã xác thực.",
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtAccessSecret()) as any;

    const userDoc = await UserModel.findById(decoded.id).select("branchId activeSessionId displayName").lean();
    if (!userDoc) {
      return res.status(401).json({ status: "error", message: "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." });
    }

    if (decoded.role !== "superadmin" && (!decoded.sid || userDoc.activeSessionId !== decoded.sid)) {
      return res.status(401).json({
        status: "error",
        code: REGULAR_SESSION_REPLACED_CODE,
        message: REGULAR_SESSION_REPLACED_MESSAGE,
      });
    }

    let branchId = userDoc?.branchId ? String(userDoc.branchId) : undefined;
    const requestedBranchId = typeof req.headers["x-branch-id"] === "string" ? req.headers["x-branch-id"] : "";
    if (decoded.role === "admin" && requestedBranchId && decoded.companyCode) {
      const selectedBranch = await BranchModel.findOne({ _id: requestedBranchId, companyCode: String(decoded.companyCode).toUpperCase(), isActive: true }).select("_id").lean();
      if (!selectedBranch) return res.status(403).json({ status: "error", message: "Chi nhánh không thuộc công ty hoặc đã ngừng hoạt động." });
      branchId = String(selectedBranch._id);
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      companyCode: decoded.companyCode,
      branchId,
      sessionId: decoded.sid,
      authLevel: decoded.authLevel,
      displayName: String(userDoc.displayName || "").trim() || undefined,
    };

    // console.log(`[requireAuth] Xác thực thành công: ${req.method} ${req.originalUrl} - User: ${decoded.email} (${decoded.role}), ID: ${decoded.id}`);
    return next();
  } catch (error) {
    if (!shouldSkipRoutineAuthLog(req.method, req.originalUrl)) {
      console.warn(`[requireAuth] JWT không hợp lệ hoặc hết hạn cho ${req.method} ${req.originalUrl}:`, (error as Error).message);
    }
    return res.status(401).json({
      status: "error",
      message: "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
}

/**
 * Middleware yêu cầu người dùng phải có vai trò phù hợp (RBAC tĩnh)
 */
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền truy cập tài nguyên này.",
      });
    }
    next();
  };
}

/**
 * Tính tập hợp mã quyền hiệu lực (permissions custom của user + RolePermission
 * của company/role, fallback DEFAULT_ROLE_PERMISSIONS nếu công ty chưa cấu hình).
 * Nguồn dùng chung cho requirePermission (middleware) và mọi nơi khác cần biết
 * quyền thật của user (vd: lọc dữ liệu tổng quan theo permission trong
 * dashboard.service.ts), để tránh hai nơi tự tính khác nhau và lệch pha.
 * superadmin luôn trả về Set(["*"]).
 */
export async function getEffectivePermissions(
  userId: string,
  role: string,
  companyCode?: string
): Promise<Set<string>> {
  if (role === "superadmin") {
    return new Set(["*"]);
  }

  const userDoc = userId
    ? await UserModel.findById(userId).select("permissions").lean()
    : null;
  const customPermissions = userDoc?.permissions || [];

  let rolePermissions: string[] = [];
  if (companyCode) {
    const rolePermissionDoc = await RolePermissionModel.findOne({
      companyCode,
      role,
    }).lean();

    if (rolePermissionDoc) {
      rolePermissions = rolePermissionDoc.permissions || [];
    } else {
      // Fallback về quyền hệ thống mặc định nếu chưa cấu hình trong DB
      rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    }
  } else {
    rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  return expandEffectivePermissions(normalizeStoredPermissions([...customPermissions, ...rolePermissions]));
}

export function hasAnyPermission(allPermissions: ReadonlySet<string>, requiredPermissions: readonly string[]) {
  return allPermissions.has("*") || requiredPermissions.some((permission) => allPermissions.has(permission));
}

export const requireAnyPermission = (permissions: string[]) => requirePermission(permissions);

/**
 * Middleware yêu cầu mã quyền động (PBAC)
 * Kiểm tra kết hợp quyền tùy chỉnh của user và cấu hình RolePermission trong database của doanh nghiệp.
 * Truyền một mảng để yêu cầu "có ít nhất một trong các mã quyền" (OR), ví dụ khi hai nhóm quyền
 * khác nhau trên UI cùng cấp quyền truy cập một tài nguyên dùng chung (vd: hr:read và access:read
 * cùng cho phép xem danh sách nhân sự).
 */
export function requirePermission(requiredPermission: string | string[]) {
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { id: userId, role, companyCode } = req.user;
      const allPermissions = await getEffectivePermissions(userId, role, companyCode);

      if (hasAnyPermission(allPermissions, requiredPermissions)) {
        return next();
      }

      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền thực hiện thao tác này.",
      });
    } catch (error: any) {
      console.error("[requirePermission] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi xác thực quyền hạn.",
        details: error.message,
      });
    }
  };
}

/**
 * Middleware bảo vệ tài nguyên theo doanh nghiệp (Tenant isolation ở cấp độ Object-level)
 */
export function requireCompanyAccess(model: mongoose.Model<any>, idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      // Superadmin được phép bỏ qua cách ly tài nguyên để quản trị hệ thống
      if (req.user.role === "superadmin") {
        return next();
      }

      const resourceId = req.params[idParamName];
      if (!resourceId) {
        return next();
      }

      // Kiểm tra xem ID có hợp lệ không
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          status: "error",
          message: "Định dạng ID tài nguyên không hợp lệ.",
        });
      }

      const resource = await model.findById(resourceId).lean();
      if (!resource) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy tài nguyên yêu cầu.",
        });
      }

      // Kiểm tra trường companyCode của tài nguyên. Nếu tài nguyên không có
      // companyCode (VD: tài khoản SYSTEM/superadmin) thì chỉ superadmin (đã
      // return ở nhánh trên) mới được truy cập — không được bỏ qua kiểm tra
      // vì điều đó sẽ cho phép mọi công ty đụng vào tài nguyên không thuộc công ty nào.
      if (resource.companyCode !== req.user.companyCode) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền truy cập hoặc chỉnh sửa tài nguyên của doanh nghiệp khác.",
        });
      }

      // Đính kèm tài nguyên vào request để sử dụng ở Controller mà không cần query lại
      req.resource = resource;
      return next();
    } catch (error: any) {
      console.error("[requireCompanyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi kiểm tra quyền hạn doanh nghiệp.",
        details: error.message,
      });
    }
  };
}

/**
 * Đệ quy kiểm tra xem employeeId có thuộc cấp dưới trực thuộc hoặc gián tiếp của managerId hay không
 */
async function isSubordinate(managerId: string, employeeId: string): Promise<boolean> {
  let currentId = employeeId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === managerId) {
      return true;
    }
    if (visited.has(currentId)) {
      break; // Chống lặp vòng lặp
    }
    visited.add(currentId);

    const user = await UserModel.findById(currentId).select("parentId").lean();
    if (!user || !user.parentId) {
      break;
    }
    currentId = user.parentId.toString();
  }

  return false;
}

/**
 * Middleware kiểm tra phân cấp quản trị sơ đồ nhân sự (Hierarchy Access)
 * Cản manager hoặc user truy cập / thay đổi trái phép cấp trên hoặc người ngoài nhánh của mình.
 */
export function requireHierarchyAccess(idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const targetUserId = req.params[idParamName];
      if (!targetUserId) {
        return next();
      }

      const { id: callerId, role } = req.user;

      // 1. Superadmin và Admin được toàn quyền quản trị (nhân sự trong cùng công ty đã được check bởi requireCompanyAccess)
      if (role === "superadmin" || role === "admin") {
        return next();
      }

      // 2. Thao tác trên chính mình -> Cho phép
      if (callerId === targetUserId) {
        return next();
      }

      // 3. Manager chỉ được xem/sửa nhân sự trực thuộc nhánh con của mình
      if (role === "manager") {
        const isSub = await isSubordinate(callerId, targetUserId);
        if (isSub) {
          return next();
        }
        return res.status(403).json({
          status: "error",
          message: "Bạn chỉ được thao tác trên hồ sơ nhân sự trực thuộc nhánh quản lý của mình.",
        });
      }

      // 4. User thường không có quyền thao tác trên người khác
      return res.status(403).json({
        status: "error",
        message: "Bạn không có quyền thao tác trên hồ sơ nhân sự của người khác.",
      });
    } catch (error: any) {
      console.error("[requireHierarchyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi xác thực phân cấp nhân sự.",
        details: error.message,
      });
    }
  };
}

