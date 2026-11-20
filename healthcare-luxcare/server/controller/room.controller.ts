import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { roomService } from "../service/room.service";

const company = (req: AuthenticatedRequest) =>
  String(req.user?.companyCode || "").trim().toUpperCase();

const canManage = (req: AuthenticatedRequest) =>
  ["admin", "superadmin", "branch_owner"].includes(String(req.user?.role || ""));

export const roomController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId
        ? String(req.query.branchId)
        : String(req.user?.branchId || "");
      const activeOnly = req.query.activeOnly === "true";
      const search = req.query.search ? String(req.query.search) : undefined;
      const type = req.query.type ? String(req.query.type) : undefined;

      const data = await roomService.list(companyCode, { branchId, activeOnly, search, type });
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const data = await roomService.getById(companyCode, req.params.id);
      if (!data) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy phòng." });
      }
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng." });
      }
      const companyCode = company(req);
      const branchId = req.body.branchId || req.user?.branchId;
      const data = await roomService.create(companyCode, { ...req.body, branchId });
      return res.status(201).json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng." });
      }
      const companyCode = company(req);
      const data = await roomService.update(companyCode, req.params.id, req.body);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền quản lý danh mục phòng." });
      }
      const companyCode = company(req);
      const result = await roomService.delete(companyCode, req.params.id);
      return res.json({ status: "success", ...result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async merge(req: AuthenticatedRequest, res: Response) {
    try {
      if (!canManage(req)) {
        return res.status(403).json({ status: "error", message: "Không có quyền chuẩn hóa vị trí phòng." });
      }
      const companyCode = company(req);
      const { branchId, sourceLocationTexts, targetRoomId } = req.body;
      const targetBranch = branchId || req.user?.branchId;
      const result = await roomService.mergeLegacy(companyCode, targetBranch, sourceLocationTexts, targetRoomId);
      return res.json({ status: "success", data: result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  async unmapped(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = company(req);
      const branchId = String(req.query.branchId || req.user?.branchId || "");
      const data = await roomService.getUnmappedLegacyLocations(companyCode, branchId);
      return res.json({ status: "success", data });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
