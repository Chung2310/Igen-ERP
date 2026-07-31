import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { getJwtAccessSecret } from "../config/env";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyCode?: string;
    branchId?: string;
    sessionId?: string;
    authLevel?: string;
  };
  resource?: any; // Äá»ƒ Ä‘Ã­nh kÃ¨m tÃ i nguyÃªn sau khi qua requireCompanyAccess
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
 * Danh sÃ¡ch mÃ£ quyá»n máº·c Ä‘á»‹nh cá»§a há»‡ thá»‘ng cho tá»«ng vai trÃ²
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ["*"],
  admin: [
    "user:read", "user:manage",
    "face:manage",
    "kanban:read", "kanban:manage",
    "project:read", "project:manage",
    "stock:read", "stock:manage",
    "hr:read", "student:read", "student:manage", "partner:read", "partner:manage", "timekeeping:read", "timekeeping:manage", "leave:approve", "payroll:read", "payroll:prepare", "payroll:manage", "payroll:pay",
    "chat:read", "resource:read", "resource:manage", "company-email:manage", "recruitment:manage",
    // student-settings:manage không nằm ở đây: loại hình doanh nghiệp chỉ SuperAdmin sửa
    "custom-field:manage", "company-smtp:manage"
  ],
  branch_owner: [
    "user:read", "user:manage", "hr:read", "timekeeping:read", "timekeeping:manage", "student:read", "student:manage", "resource:read", "chat:read", "kanban:read", "kanban:manage"
  ],
  manager: [
    "user:read", "user:manage",
    "kanban:read", "kanban:manage",
    "project:read", "project:manage",
    "stock:read",
    "hr:read", "student:read", "timekeeping:read", "chat:read", "resource:read", "custom-field:manage"
  ],
  user: [
    "user:read",
    "kanban:read", "kanban:manage",
    "project:read",
    "stock:read",
    "hr:read", "student:read", "timekeeping:read", "chat:read", "resource:read"
  ]
};

/**
 * Cáº¥p báº­c máº·c Ä‘á»‹nh cá»§a cÃ¡c vai trÃ² há»‡ thá»‘ng (Sá»‘ nhá» hÆ¡n = cáº¥p cao hÆ¡n)
 */
export const DEFAULT_ROLE_LEVELS: Record<string, number> = {
  superadmin: 1,
  admin: 2,
  branch_owner: 2,
  manager: 3,
  user: 4
};

/**
 * Middleware yÃªu cáº§u Ä‘Äƒng nháº­p báº±ng Access Token
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
    console.warn(`[requireAuth] Tá»« chá»‘i truy cáº­p ${req.method} ${req.originalUrl}: KhÃ´ng tÃ¬m tháº¥y Access Token.`);
    return res.status(401).json({
      status: "error",
      message: "YÃªu cáº§u Ä‘Äƒng nháº­p. KhÃ´ng tÃ¬m tháº¥y mÃ£ xÃ¡c thá»±c.",
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtAccessSecret()) as any;

    const userDoc = await UserModel.findById(decoded.id).select("branchId").lean();
    let branchId = userDoc?.branchId ? String(userDoc.branchId) : undefined;
    const requestedBranchId = typeof req.headers["x-branch-id"] === "string" ? req.headers["x-branch-id"] : "";
    if (decoded.role === "admin" && requestedBranchId && decoded.companyCode) {
      const selectedBranch = await BranchModel.findOne({ _id: requestedBranchId, companyCode: String(decoded.companyCode).toUpperCase(), isActive: true }).select("_id").lean();
      if (!selectedBranch) return res.status(403).json({ status: "error", message: "Chi nhÃ¡nh khÃ´ng thuá»™c cÃ´ng ty hoáº·c Ä‘Ã£ ngá»«ng hoáº¡t Ä‘á»™ng." });
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
    };

    // console.log(`[requireAuth] XÃ¡c thá»±c thÃ nh cÃ´ng: ${req.method} ${req.originalUrl} - User: ${decoded.email} (${decoded.role}), ID: ${decoded.id}`);
    return next();
  } catch (error) {
    if (!shouldSkipRoutineAuthLog(req.method, req.originalUrl)) {
      console.warn(`[requireAuth] JWT khÃ´ng há»£p lá»‡ hoáº·c háº¿t háº¡n cho ${req.method} ${req.originalUrl}:`, (error as Error).message);
    }
    return res.status(401).json({
      status: "error",
      message: "MÃ£ xÃ¡c thá»±c khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.",
    });
  }
}

/**
 * Middleware yÃªu cáº§u ngÆ°á»i dÃ¹ng pháº£i cÃ³ vai trÃ² phÃ¹ há»£p (RBAC tÄ©nh)
 */
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p tÃ i nguyÃªn nÃ y.",
      });
    }
    next();
  };
}

/**
 * TÃ­nh táº­p há»£p mÃ£ quyá»n hiá»‡u lá»±c (permissions custom cá»§a user + RolePermission
 * cá»§a company/role, fallback DEFAULT_ROLE_PERMISSIONS náº¿u cÃ´ng ty chÆ°a cáº¥u hÃ¬nh).
 * Nguá»“n dÃ¹ng chung cho requirePermission (middleware) vÃ  má»i nÆ¡i khÃ¡c cáº§n biáº¿t
 * quyá»n tháº­t cá»§a user (vd: lá»c dá»¯ liá»‡u tá»•ng quan theo permission trong
 * dashboard.service.ts), Ä‘á»ƒ trÃ¡nh hai nÆ¡i tá»± tÃ­nh khÃ¡c nhau vÃ  lá»‡ch pha.
 * superadmin luÃ´n tráº£ vá» Set(["*"]).
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
      // Fallback vá» quyá»n há»‡ thá»‘ng máº·c Ä‘á»‹nh náº¿u chÆ°a cáº¥u hÃ¬nh trong DB
      rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    }
  } else {
    rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  return new Set([...customPermissions, ...rolePermissions]);
}

export function hasAnyPermission(allPermissions: ReadonlySet<string>, requiredPermissions: readonly string[]) {
  return allPermissions.has("*") || requiredPermissions.some((permission) => allPermissions.has(permission));
}

export const requireAnyPermission = (permissions: string[]) => requirePermission(permissions);

/**
 * Middleware yÃªu cáº§u mÃ£ quyá»n Ä‘á»™ng (PBAC)
 * Kiá»ƒm tra káº¿t há»£p quyá»n tÃ¹y chá»‰nh cá»§a user vÃ  cáº¥u hÃ¬nh RolePermission trong database cá»§a doanh nghiá»‡p.
 * Truyá»n má»™t máº£ng Ä‘á»ƒ yÃªu cáº§u "cÃ³ Ã­t nháº¥t má»™t trong cÃ¡c mÃ£ quyá»n" (OR), vÃ­ dá»¥ khi hai nhÃ³m quyá»n
 * khÃ¡c nhau trÃªn UI cÃ¹ng cáº¥p quyá»n truy cáº­p má»™t tÃ i nguyÃªn dÃ¹ng chung (vd: hr:read vÃ  user:read
 * cÃ¹ng cho phÃ©p xem danh sÃ¡ch nhÃ¢n sá»±).
 */
export function requirePermission(requiredPermission: string | string[]) {
  const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "NgÆ°á»i dÃ¹ng chÆ°a xÃ¡c thá»±c.",
        });
      }

      const { id: userId, role, companyCode } = req.user;
      const allPermissions = await getEffectivePermissions(userId, role, companyCode);

      if (hasAnyPermission(allPermissions, requiredPermissions)) {
        return next();
      }

      return res.status(403).json({
        status: "error",
        message: `TÃ i khoáº£n cá»§a báº¡n khÃ´ng cÃ³ mÃ£ quyá»n [${requiredPermissions.join(", ")}] cáº§n thiáº¿t Ä‘á»ƒ thá»±c hiá»‡n thao tÃ¡c nÃ y.`,
      });
    } catch (error: any) {
      console.error("[requirePermission] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "CÃ³ lá»—i xáº£y ra khi xÃ¡c thá»±c quyá»n háº¡n.",
        details: error.message,
      });
    }
  };
}

/**
 * Middleware báº£o vá»‡ tÃ i nguyÃªn theo doanh nghiá»‡p (Tenant isolation á»Ÿ cáº¥p Ä‘á»™ Object-level)
 */
export function requireCompanyAccess(model: mongoose.Model<any>, idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "NgÆ°á»i dÃ¹ng chÆ°a xÃ¡c thá»±c.",
        });
      }

      // Superadmin Ä‘Æ°á»£c phÃ©p bá» qua cÃ¡ch ly tÃ i nguyÃªn Ä‘á»ƒ quáº£n trá»‹ há»‡ thá»‘ng
      if (req.user.role === "superadmin") {
        return next();
      }

      const resourceId = req.params[idParamName];
      if (!resourceId) {
        return next();
      }

      // Kiá»ƒm tra xem ID cÃ³ há»£p lá»‡ khÃ´ng
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          status: "error",
          message: "Äá»‹nh dáº¡ng ID tÃ i nguyÃªn khÃ´ng há»£p lá»‡.",
        });
      }

      const resource = await model.findById(resourceId).lean();
      if (!resource) {
        return res.status(404).json({
          status: "error",
          message: "KhÃ´ng tÃ¬m tháº¥y tÃ i nguyÃªn yÃªu cáº§u.",
        });
      }

      // Kiá»ƒm tra trÆ°á»ng companyCode cá»§a tÃ i nguyÃªn. Náº¿u tÃ i nguyÃªn khÃ´ng cÃ³
      // companyCode (VD: tÃ i khoáº£n SYSTEM/superadmin) thÃ¬ chá»‰ superadmin (Ä‘Ã£
      // return á»Ÿ nhÃ¡nh trÃªn) má»›i Ä‘Æ°á»£c truy cáº­p â€” khÃ´ng Ä‘Æ°á»£c bá» qua kiá»ƒm tra
      // vÃ¬ Ä‘iá»u Ä‘Ã³ sáº½ cho phÃ©p má»i cÃ´ng ty Ä‘á»¥ng vÃ o tÃ i nguyÃªn khÃ´ng thuá»™c cÃ´ng ty nÃ o.
      if (resource.companyCode !== req.user.companyCode) {
        return res.status(403).json({
          status: "error",
          message: "Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p hoáº·c chá»‰nh sá»­a tÃ i nguyÃªn cá»§a doanh nghiá»‡p khÃ¡c.",
        });
      }

      // ÄÃ­nh kÃ¨m tÃ i nguyÃªn vÃ o request Ä‘á»ƒ sá»­ dá»¥ng á»Ÿ Controller mÃ  khÃ´ng cáº§n query láº¡i
      req.resource = resource;
      return next();
    } catch (error: any) {
      console.error("[requireCompanyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "CÃ³ lá»—i xáº£y ra khi kiá»ƒm tra quyá»n háº¡n doanh nghiá»‡p.",
        details: error.message,
      });
    }
  };
}

/**
 * Äá»‡ quy kiá»ƒm tra xem employeeId cÃ³ thuá»™c cáº¥p dÆ°á»›i trá»±c thuá»™c hoáº·c giÃ¡n tiáº¿p cá»§a managerId hay khÃ´ng
 */
async function isSubordinate(managerId: string, employeeId: string): Promise<boolean> {
  let currentId = employeeId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === managerId) {
      return true;
    }
    if (visited.has(currentId)) {
      break; // Chá»‘ng láº·p vÃ²ng láº·p
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
 * Middleware kiá»ƒm tra phÃ¢n cáº¥p quáº£n trá»‹ sÆ¡ Ä‘á»“ nhÃ¢n sá»± (Hierarchy Access)
 * Cáº£n manager hoáº·c user truy cáº­p / thay Ä‘á»•i trÃ¡i phÃ©p cáº¥p trÃªn hoáº·c ngÆ°á»i ngoÃ i nhÃ¡nh cá»§a mÃ¬nh.
 */
export function requireHierarchyAccess(idParamName: string = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "NgÆ°á»i dÃ¹ng chÆ°a xÃ¡c thá»±c.",
        });
      }

      const targetUserId = req.params[idParamName];
      if (!targetUserId) {
        return next();
      }

      const { id: callerId, role } = req.user;

      // 1. Superadmin vÃ  Admin Ä‘Æ°á»£c toÃ n quyá»n quáº£n trá»‹ (nhÃ¢n sá»± trong cÃ¹ng cÃ´ng ty Ä‘Ã£ Ä‘Æ°á»£c check bá»Ÿi requireCompanyAccess)
      if (role === "superadmin" || role === "admin") {
        return next();
      }

      // 2. Thao tÃ¡c trÃªn chÃ­nh mÃ¬nh -> Cho phÃ©p
      if (callerId === targetUserId) {
        return next();
      }

      // 3. Manager chá»‰ Ä‘Æ°á»£c xem/sá»­a nhÃ¢n sá»± trá»±c thuá»™c nhÃ¡nh con cá»§a mÃ¬nh
      if (role === "manager") {
        const isSub = await isSubordinate(callerId, targetUserId);
        if (isSub) {
          return next();
        }
        return res.status(403).json({
          status: "error",
          message: "Báº¡n chá»‰ Ä‘Æ°á»£c thao tÃ¡c trÃªn há»“ sÆ¡ nhÃ¢n sá»± trá»±c thuá»™c nhÃ¡nh quáº£n lÃ½ cá»§a mÃ¬nh.",
        });
      }

      // 4. User thÆ°á»ng khÃ´ng cÃ³ quyá»n thao tÃ¡c trÃªn ngÆ°á»i khÃ¡c
      return res.status(403).json({
        status: "error",
        message: "Báº¡n khÃ´ng cÃ³ quyá»n thao tÃ¡c trÃªn há»“ sÆ¡ nhÃ¢n sá»± cá»§a ngÆ°á»i khÃ¡c.",
      });
    } catch (error: any) {
      console.error("[requireHierarchyAccess] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "CÃ³ lá»—i xáº£y ra khi xÃ¡c thá»±c phÃ¢n cáº¥p nhÃ¢n sá»±.",
        details: error.message,
      });
    }
  };
}

