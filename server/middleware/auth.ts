import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserModel } from "../model/user.model";
import { RolePermissionModel } from "../model/role-permission.model";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyCode?: string;
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
  admin: [
    "user:read", "user:manage",
    "crm:read", "crm:manage",
    "kanban:read", "kanban:manage",
    "project:read", "project:manage",
    "stock:read", "stock:manage",
    "marketing:post"
  ],
  manager: [
    "user:read", "user:manage",
    "crm:read", "crm:manage",
    "kanban:read", "kanban:manage",
    "project:read", "project:manage",
    "stock:read",
    "marketing:post"
  ],
  user: [
    "user:read",
    "crm:read",
    "kanban:read", "kanban:manage",
    "project:read",
    "stock:read",
    "marketing:post"
  ]
};

/**
 * Cấp bậc mặc định của các vai trò hệ thống (Số nhỏ hơn = cấp cao hơn)
 */
export const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  superadmin: 1,
  admin: 2,
  manager: 3,
  user: 4
};

/**
 * Middleware yêu cầu đăng nhập bằng Access Token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn(`[requireAuth] Từ chối truy cập ${req.method} ${req.originalUrl}: Không có Authorization header.`);
    return res.status(401).json({
      status: "error",
      message: "Yêu cầu đăng nhập. Không tìm thấy mã xác thực.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || "your_jwt_access_secret_key"
    ) as any;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      companyCode: decoded.companyCode,
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
 * Middleware yêu cầu mã quyền động (PBAC)
 * Kiểm tra kết hợp quyền tùy chỉnh của user và cấu hình RolePermission trong database của doanh nghiệp.
 */
export function requirePermission(requiredPermission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { id: userId, role, companyCode } = req.user;

      // 1. Superadmin tự động bypass tất cả kiểm tra quyền
      if (role === "superadmin") {
        return next();
      }

      // 2. Truy vấn quyền riêng của người dùng
      const userDoc = await UserModel.findById(userId).select("permissions").lean();
      const customPermissions = userDoc?.permissions || [];

      // 3. Truy vấn cấu hình quyền của Role thuộc doanh nghiệp
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

      const allPermissions = new Set([...customPermissions, ...rolePermissions]);

      // 4. Xác thực mã quyền
      if (allPermissions.has(requiredPermission) || allPermissions.has("*")) {
        return next();
      }

      return res.status(403).json({
        status: "error",
        message: `Tài khoản của bạn không có mã quyền [${requiredPermission}] cần thiết để thực hiện thao tác này.`,
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

      // Kiểm tra trường companyCode của tài nguyên
      if (resource.companyCode && resource.companyCode !== req.user.companyCode) {
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
