import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { crudService } from "../service/crud.service";
import { SupportedModelName } from "../interface/crud.interface";

export const crudController = {
  /**
   * GET /api/v1/crud/:modelName
   */
  async getList(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 1000;
      const sort = req.query.sort as string;
      const search = req.query.search as string;

      // Trích xuất các tham số còn lại làm bộ lọc động (filters)
      const { page: _p, limit: _l, sort: _s, search: _sh, ...filters } = req.query;

      const result = await crudService.getList(modelName, companyCode, {
        page,
        limit,
        sort,
        search,
        filters,
      }, userRole);

      return res.status(200).json({
        status: "success",
        data: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: any) {
      console.error("[crudController.getList] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tải danh sách tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/crud/:modelName/:id
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const item = await crudService.getById(modelName as SupportedModelName, id, companyCode, userRole);
      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.getById] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tải thông tin tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/crud/:modelName
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";

      const item = await crudService.create(modelName, req.body, companyCode);
      return res.status(201).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.create] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tạo mới tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/crud/:modelName/:id
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const item = await crudService.update(modelName as SupportedModelName, id, req.body, companyCode, userRole);
      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.update] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi cập nhật tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/crud/:modelName/:id
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const item = await crudService.delete(modelName as SupportedModelName, id, companyCode, userRole);
      return res.status(200).json({
        status: "success",
        message: "Xóa tài nguyên thành công",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.delete] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi xóa tài nguyên",
        details: error.message,
      });
    }
  },
};
