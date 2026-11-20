import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { supplierService } from "../service/supplier.service";

const company = (req: AuthenticatedRequest) =>
  String(req.user?.companyCode || "").trim().toUpperCase();

export const supplierController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const activeOnly = req.query.activeOnly === "true" || req.query.activeOnly === "1";
      const search = req.query.search ? String(req.query.search) : undefined;

      const data = await supplierService.list(companyCode, { search, activeOnly });
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await supplierService.getById(companyCode, req.params.id);
      if (!data) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy nhà cung cấp." });
      }
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await supplierService.create(companyCode, req.body);
      return res.status(201).json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await supplierService.update(companyCode, req.params.id, req.body);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await supplierService.delete(companyCode, req.params.id);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
