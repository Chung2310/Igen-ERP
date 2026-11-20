import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { warehouseService } from "../service/warehouse.service";

const company = (req: AuthenticatedRequest) =>
  String(req.user?.companyCode || "").trim().toUpperCase();

export const warehouseController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId ? String(req.query.branchId) : String((req as any).user?.branchId || "") || undefined;
      const activeOnly = req.query.activeOnly === "true" || req.query.activeOnly === "1";
      const search = req.query.search ? String(req.query.search) : undefined;

      const data = await warehouseService.list(companyCode, { branchId, search, activeOnly });
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await warehouseService.getById(companyCode, req.params.id);
      if (!data) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy kho lưu trữ." });
      }
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const branchId = req.body.branchId || (req as any).user?.branchId || "";
      const data = await warehouseService.create(companyCode, { ...req.body, branchId });
      return res.status(201).json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await warehouseService.update(companyCode, req.params.id, req.body);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await warehouseService.delete(companyCode, req.params.id);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
