import { Response } from "express";
import { rolePermissionService } from "../service/role-permission.service";
import { AuthenticatedRequest, DEFAULT_ROLE_LEVELS } from "../middleware/auth";
import { RolePermissionModel } from "../model/role-permission.model";
import { UserModel } from "../model/user.model";
import { emitToUser } from "../socket";

export const rolePermissionController = {
  /**
   * POST /api/v1/role-permissions
   */
  async save(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const companyCode = user.role === "superadmin" ? (req.body.companyCode || "SYSTEM") : user.companyCode;
      if (!companyCode) {
        return res.status(400).json({ status: "error", code: "ROLE_COMPANY_REQUIRED", message: "Mã công ty là bắt buộc." });
      }
      const saveInput = { ...req.body, companyCode };

      // Không cho phép tự chỉnh sửa quyền/cấp bậc của chính vai trò mình đang giữ (chặn leo thang đặc quyền)
      if (user.role !== "superadmin" && req.body.role === user.role) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không thể tự chỉnh sửa quyền hoặc cấp bậc của vai trò mà bạn đang giữ.",
        });
      }

      // Ngăn chặn admin chỉnh sửa vai trò superadmin hoặc vai trò admin khác
      if (user.role !== "superadmin" && (req.body.role === "superadmin" || req.body.role === "admin")) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không thể tạo hoặc chỉnh sửa vai trò admin hoặc superadmin.",
        });
      }

      // Kiểm tra phân cấp cấp bậc (Hierarchy Level Check)
      let callerLevel = 1;
      if (user.role !== "superadmin") {
        const callerRolePerm = await RolePermissionModel.findOne({
          companyCode: user.companyCode,
          role: user.role,
        });
        callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[user.role] || 4);
      }

      const targetLevel = saveInput.level;
      if (user.role !== "superadmin") {
        if (typeof targetLevel === "number" && targetLevel <= callerLevel) {
          return res.status(403).json({
            status: "error",
            message: `Bạn không thể tạo hoặc chỉnh sửa vai trò có cấp bậc (${targetLevel}) tương đương hoặc cao hơn cấp bậc của bạn (${callerLevel}).`,
          });
        }
      }

      // Kiểm tra xem vai trò cũ nếu có thì có bị vượt cấp không
      const existingRole = await RolePermissionModel.findOne({
        companyCode,
        role: req.body.role,
      });

      if (user.role !== "superadmin" && user.role !== "admin" && existingRole && existingRole.level <= callerLevel) {
        return res.status(403).json({
          status: "error",
          message: `Bạn không có quyền chỉnh sửa vai trò [${req.body.role}] vì vai trò này có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.`,
        });
      }

      const rolePermission = await rolePermissionService.saveRolePermission(saveInput);
      const affectedUsers = await UserModel.find({ companyCode, role: req.body.role }).select("_id");
      affectedUsers.forEach((affectedUser) => emitToUser(affectedUser._id.toString(), "role_permissions_updated", { userId: affectedUser._id.toString(), companyCode, role: req.body.role }));
      return res.status(200).json({
        status: "success",
        message: "Cập nhật cấu hình phân quyền vai trò thành công.",
        data: rolePermission,
      });
    } catch (error: any) {
      console.error("[rolePermissionController.save] Error:", error);
      return res.status(400).json({
        status: "error",
        ...(error.code ? { code: error.code } : {}),
        ...(Array.isArray(error.invalidCodes) ? { invalidCodes: error.invalidCodes } : {}),
        message: error.message || "Không thể cập nhật cấu hình phân quyền vai trò.",
      });
    }
  },

  /**
   * GET /api/v1/role-permissions
   */
  async getList(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { page, limit, role } = req.query as any;
      const filter: any = {};

      // Nếu không phải superadmin, chỉ được lấy cấu hình của doanh nghiệp mình
      if (user.role !== "superadmin") {
        filter.companyCode = user.companyCode;
      } else if (req.query.companyCode) {
        filter.companyCode = (req.query.companyCode as string).toUpperCase().trim();
      }

      if (role) {
        filter.role = role;
      }

      const result = await rolePermissionService.getRolePermissions(filter, {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return res.status(200).json({
        status: "success",
        ...result,
      });
    } catch (error: any) {
      console.error("[rolePermissionController.getList] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách cấu hình phân quyền vai trò.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/role-permissions/:role
   */
  async getDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { role } = req.params;
      let companyCode = req.query.companyCode as string;

      if (user.role !== "superadmin") {
        companyCode = user.companyCode || "";
      } else if (!companyCode) {
        return res.status(400).json({
          status: "error",
          message: "Tham số companyCode là bắt buộc đối với Superadmin.",
        });
      }

      const rolePermission = await rolePermissionService.getRolePermission(companyCode, role);
      if (!rolePermission) {
        return res.status(404).json({
          status: "error",
          message: `Không tìm thấy cấu hình vai trò [${role}] cho công ty [${companyCode}].`,
        });
      }

      return res.status(200).json({
        status: "success",
        data: rolePermission,
      });
    } catch (error: any) {
      console.error("[rolePermissionController.getDetail] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy chi tiết cấu hình vai trò.",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/role-permissions/:role
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const { role } = req.params;
      let companyCode = req.query.companyCode as string;

      if (user.role !== "superadmin") {
        companyCode = user.companyCode || "";
      } else if (!companyCode) {
        return res.status(400).json({
          status: "error",
          message: "Tham số companyCode là bắt buộc đối với Superadmin.",
        });
      }

      // Ngăn chặn tự xóa vai trò của bản thân
      if (user.role !== "superadmin" && role === user.role) {
        return res.status(400).json({
          status: "error",
          message: "Bạn không thể tự xóa vai trò hiện tại của chính mình.",
        });
      }

      // Ngăn chặn xóa vai trò admin hoặc superadmin
      if (user.role !== "superadmin" && (role === "admin" || role === "superadmin")) {
        return res.status(403).json({
          status: "error",
          message: "Bạn không thể xóa vai trò admin hoặc superadmin.",
        });
      }

      // Kiểm tra phân cấp cấp bậc (Hierarchy Level Check)
      let callerLevel = 1;
      if (user.role !== "superadmin") {
        const callerRolePerm = await RolePermissionModel.findOne({
          companyCode: user.companyCode,
          role: user.role,
        });
        callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[user.role] || 4);
      }

      const existingRole = await RolePermissionModel.findOne({
        companyCode,
        role,
      });

      if (!existingRole) {
        return res.status(404).json({
          status: "error",
          message: `Không tìm thấy cấu hình vai trò [${role}] để xóa.`,
        });
      }

      if (user.role !== "superadmin" && user.role !== "admin" && existingRole.level <= callerLevel) {
        return res.status(403).json({
          status: "error",
          message: `Bạn không có quyền xóa vai trò [${role}] vì vai trò này có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.`,
        });
      }

      const affectedUsers = await UserModel.find({ companyCode, role }).select("_id");
      await rolePermissionService.deleteRolePermission(companyCode, role);
      affectedUsers.forEach((affectedUser) => emitToUser(affectedUser._id.toString(), "role_permissions_updated", { userId: affectedUser._id.toString(), companyCode, role }));
      return res.status(200).json({
        status: "success",
        message: "Xóa cấu hình phân quyền vai trò thành công.",
      });
    } catch (error: any) {
      console.error("[rolePermissionController.delete] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể xóa cấu hình phân quyền vai trò.",
      });
    }
  },
};
