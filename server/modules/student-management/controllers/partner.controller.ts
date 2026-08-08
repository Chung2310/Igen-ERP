import { NotFoundError, ValidationError } from "../../../errors/app-error";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { PartnerService } from "../services/partner.service";
import { getAllowedOwnerIds, resolveCreateOwnerId, requireStudentBranch } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import { importResourceService } from "../../../service/import-resource.service";
import { resourceIndexingService } from "../../../service/resource-indexing.service";

export class PartnerController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let ownerId = req.user!.uid;

      if (req.user!.role === "superadmin") {
        const companyCode = req.body.companyCode || req.body.centerId || req.query.companyCode || req.query.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          throw new ValidationError("TENANT_REQUIRED", "Vui lòng chọn công ty quản lý.", { field: "companyCode" });
        }
        ownerId = await resolveCreateOwnerId(req.user!, companyCode);
      } else if (req.user!.role === "admin" || req.user!.role === "manager") {
        ownerId = await resolveCreateOwnerId(req.user!);
      }

      const partner = await PartnerService.createPartner(ownerId, { ...req.body, branchId: req.user!.branchId }, {
        tenantId: req.user!.role === "superadmin" ? await resolveCustomFieldTenantForOwner(ownerId) : (req.user!.companyCode || req.user!.centerId),
        moduleKey: "partners",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      });
      res.status(201).json({ success: true, data: partner });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async bulkCreate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const creatorId = req.user!.uid;
      const ownerId = await getAllowedOwnerIds(req.user!);
      let targetOwnerId: string | undefined;
      let resourceCompanyCode = req.user!.companyCode;

      if (req.user!.role === "superadmin") {
        const companyCode = req.query.centerId || req.body.centerId || req.query.companyCode || req.body.companyCode;
        if (!companyCode || typeof companyCode !== "string") {
          throw new ValidationError("TENANT_REQUIRED", "Vui lòng chọn công ty quản lý.", { field: "companyCode" });
        }
        resourceCompanyCode = companyCode.trim().toUpperCase();
        targetOwnerId = await resolveCreateOwnerId(req.user!, companyCode);
      }

      const partners = req.body.partners;
      if (!Array.isArray(partners)) {
        throw new ValidationError("PARTNER_LIST_REQUIRED", "Dữ liệu đối tác phải là một danh sách.", { field: "partners" });
      }

      const result = await PartnerService.bulkCreatePartners(creatorId, ownerId, partners, targetOwnerId, req.user!.branchId);
      if (req.body.importUpload?.uploadToken && req.body.importUpload?.fileName) {
        await importResourceService.recordSuccessfulImport({
          companyCode: resourceCompanyCode,
          branchId: req.user!.branchId,
          actorId: creatorId,
          actorName: req.user!.email,
        }, {
          sourceType: "import.partner",
          uploadToken: String(req.body.importUpload.uploadToken),
          fileName: String(req.body.importUpload.fileName),
          importedCount: result.importedCount,
          skippedCount: result.skippedCount,
        });
      }
      res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await PartnerService.getPartners(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const partner = await PartnerService.getPartnerById(ownerId, req.params.id, req.user!.branchId);
      if (!partner) {
        throw new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy đối tác.");
      }
      res.json({ success: true, data: partner });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const partner = await PartnerService.updatePartner(ownerId, req.params.id, req.body, {
        tenantId: req.user!.companyCode || req.user!.centerId,
        moduleKey: "partners",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      });
      if (!partner) {
        throw new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy đối tác để cập nhật.");
      }
      res.json({ success: true, data: partner });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const partner = await PartnerService.deletePartner(ownerId, req.params.id, req.user!.branchId);
      if (!partner) {
        throw new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy đối tác để xóa.");
      }
      await resourceIndexingService.trashSourceRecordResources(req.user!.companyCode || req.user!.centerId, "student.custom-field", String(partner._id));
      res.json({ success: true, data: partner });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async addPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const partner = await PartnerService.addPayout(ownerId, req.params.id, req.body, req.user!.branchId);
      res.json({ success: true, data: partner });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getCommissionLevels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Phải dùng cùng ownerId với luồng tạo. Admin/manager ghi cấu hình vào
      // owner chính của doanh nghiệp, không phải uid của tài khoản nhân viên.
      const ownerId = req.user!.role === "superadmin"
        ? (typeof req.query.ownerFilter === "string" ? req.query.ownerFilter : "ALL")
        : ["admin", "manager"].includes(req.user!.role)
          ? await resolveCreateOwnerId(req.user!)
          : req.user!.uid;

      const levels = await PartnerService.getCommissionLevels(ownerId, req.user!.branchId);
      res.json({ success: true, data: levels });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async createCommissionLevel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (["admin", "manager", "branch_owner"].includes(req.user!.role)) {
        requireStudentBranch(req.user!);
      }
      let ownerId = req.user!.uid;

      if (req.user!.role === "superadmin") {
        const companyCode = req.body.companyCode || req.body.centerId || req.query.companyCode || req.query.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          throw new ValidationError("TENANT_REQUIRED", "Vui lòng chọn công ty quản lý.", { field: "companyCode" });
        }
        ownerId = await resolveCreateOwnerId(req.user!, companyCode);
      } else if (req.user!.role === "admin" || req.user!.role === "manager") {
        ownerId = await resolveCreateOwnerId(req.user!);
      }

      const level = await PartnerService.createCommissionLevel(ownerId, { ...req.body, branchId: req.user!.branchId });
      res.status(201).json({ success: true, data: level });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async deleteCommissionLevel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const level = await PartnerService.deleteCommissionLevel(ownerId, req.params.id, req.user!.branchId);
      if (!level) {
        throw new NotFoundError("COMMISSION_LEVEL_NOT_FOUND", "Không tìm thấy cấp bậc hoa hồng để xóa.");
      }
      res.json({ success: true, data: level });
    } catch (error: unknown) {
      next(error);
    }
  }
}
