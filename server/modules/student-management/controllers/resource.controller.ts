import { Response, NextFunction } from "express";
import { ResourceService } from "../services/resource.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId, requireStudentBranch } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import { resourceIndexingService } from "../../../service/resource-indexing.service";

export class ResourceController {
  static async create(req: AuthRequest, res: Response) {
    try {
      if (["admin", "manager", "branch_owner"].includes(req.user!.role)) {
        requireStudentBranch(req.user!);
      }
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const resource = await ResourceService.createResource(ownerId, { ...req.body, branchId: req.user!.branchId }, {
        tenantId: req.user!.role === "superadmin" ? await resolveCustomFieldTenantForOwner(ownerId) : (req.user!.companyCode || req.user!.centerId),
        moduleKey: "resources",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      });
      res.status(201).json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await ResourceService.getResources(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.getResourceById(ownerId, req.params.id, req.user!.branchId);
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
      const resource = await ResourceService.updateResource(ownerId, req.params.id, req.body, {
        tenantId: req.user!.companyCode || req.user!.centerId,
        moduleKey: "resources",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      }, req.user!.branchId);
      if (!resource) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên để cập nhật." });
      }
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      const status = typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 400;
      res.status(status).json({ success: false, error: msg });
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.deleteResource(ownerId, req.params.id, req.user!.branchId);
      if (!resource) {
        return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên để xóa." });
      }
      await resourceIndexingService.trashSourceRecordResources(req.user!.companyCode || req.user!.centerId, "student.custom-field", String(resource._id));
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async book(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.bookResource(ownerId, req.params.id, req.body, req.user!.branchId);
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async cancelBooking(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const resource = await ResourceService.cancelBooking(ownerId, req.params.id, req.params.bookingId, req.user!.branchId);
      res.json({ success: true, data: resource });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
