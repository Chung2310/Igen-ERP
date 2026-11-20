import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { departmentService } from "../service/department.service";

const company = (req: AuthenticatedRequest) =>
  String(req.user?.companyCode || "").trim().toUpperCase();

const canManage = (req: AuthenticatedRequest) =>
  ["admin", "superadmin"].includes(String(req.user?.role || ""));

export const departmentController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const activeOnly = req.query.activeOnly === "true";
      const search = req.query.search ? String(req.query.search) : undefined;

      const data = await departmentService.list(companyCode, { activeOnly, search });
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await departmentService.getById(companyCode, req.params.id);
      if (!data) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phòng ban." });
      }
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng ban." });
      }
      const companyCode = company(req);
      const data = await departmentService.create(companyCode, req.body);
      return res.status(201).json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng ban." });
      }
      const companyCode = company(req);
      const data = await departmentService.update(companyCode, req.params.id, req.body);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng ban." });
      }
      const companyCode = company(req);
      const result = await departmentService.delete(companyCode, req.params.id);
      return res.json({ status: "success", ...result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async merge(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền chuẩn hóa dữ liệu phòng ban." });
      }
      const companyCode = company(req);
      const { sourceDepartmentTexts, targetDepartmentId } = req.body;
      const result = await departmentService.mergeLegacy(companyCode, sourceDepartmentTexts, targetDepartmentId);
      return res.json({ status: "success", data: result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async unmapped(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await departmentService.getUnmappedLegacyDepartments(companyCode);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
