import { Response, NextFunction } from "express";
import { ResourceService } from "../services/resource.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class ResourceController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const resource = await ResourceService.createResource(ownerId, req.body);
      res.status(201).json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await ResourceService.getResources(ownerId, req.query);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.getResourceById(ownerId, req.params.id);
      if (!resource) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên." });
      }
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.updateResource(ownerId, req.params.id, req.body);
      if (!resource) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên để cập nhật." });
      }
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.deleteResource(ownerId, req.params.id);
      if (!resource) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên để xóa." });
      }
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async book(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.bookResource(ownerId, req.params.id, req.body);
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async cancelBooking(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.cancelBooking(ownerId, req.params.id, req.params.bookingId);
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
