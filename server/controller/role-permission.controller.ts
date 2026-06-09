import { Response } from "express";
import { rolePermissionService } from "../service/role-permission.service";
import { AuthenticatedRequest } from "../middleware/auth";

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

      // Khách hàng không phải superadmin thì không được sửa công ty khác
      if (user.role !== "superadmin") {
        req.body.companyCode = user.companyCode;
      }

      const rolePermission = await rolePermissionService.saveRolePermission(req.body);
      return res.status(200).json({
        status: "success",
        message: "Cập nhật cấu hình phân quyền vai trò thành công.",
        data: rolePermission,
      });
    } catch (error: any) {
      console.error("[rolePermissionController.save] Error:", error);
      return res.status(400).json({
        status: "error",
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

      await rolePermissionService.deleteRolePermission(companyCode, role);
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
