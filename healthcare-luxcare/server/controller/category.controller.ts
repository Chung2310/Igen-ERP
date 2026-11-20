import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { categoryService } from "../service/category.service";

const company = (req: AuthenticatedRequest) =>
  String(req.user?.companyCode || "").trim().toUpperCase();

export const categoryController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const activeOnly = req.query.activeOnly === "true" || req.query.activeOnly === "1";
      const search = req.query.search ? String(req.query.search) : undefined;

      const data = await categoryService.list(companyCode, { search, activeOnly });
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await categoryService.getById(companyCode, req.params.id);
      if (!data) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phân loại sản phẩm." });
      }
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await categoryService.create(companyCode, req.body);
      return res.status(201).json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await categoryService.update(companyCode, req.params.id, req.body);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await categoryService.delete(companyCode, req.params.id);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
