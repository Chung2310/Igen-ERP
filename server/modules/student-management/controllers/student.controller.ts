import { Request, Response, NextFunction } from "express";
import { ValidationError } from "../../../errors/app-error";
import { StudentService } from "../services/student.service";
import { StudentLearningHistoryService } from "../services/student-learning-history.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";
import { getAllowedOwnerIds, getCenterOwnerIds, resolveCreateOwnerId, requireStudentBranch } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import { ModuleSettingsService } from "../services/module-settings.service";
import { importResourceService } from "../../../service/import-resource.service";
import { resourceIndexingService } from "../../../service/resource-indexing.service";
import { managedUploadService } from "../../../service/managed-upload.service";
import { sourceUploadFinalizer } from "../../../service/source-upload-finalizer.service";
import { WorkerService } from "../../worker-management/services/worker.service";
import { WorkerReferralService } from "../../worker-management/labor-partners/services/worker-referral.service";
import { LaborPartnerModel } from "../../worker-management/labor-partners/models/labor-partner.model";
import { Partner } from "../models/partner.model";
import { BranchModel } from "../../../model/branch.model";
import { User } from "../models/user.model";
import {
  createPublicRegistrationToken,
  type PublicRegistrationContext,
  verifyPublicRegistrationToken,
} from "../services/public-registration-context.service";
import {
  findMissingPublicRegisterFields,
  resolvePublicRegisterFields,
} from "../utils/public-register-fields.util";

/** Tên hiển thị của người đang thao tác, để lưu làm "người thêm" trên bản ghi học viên. */
async function resolveActorName(uid: string, fallbackEmail?: string): Promise<string> {
  try {
    const profile = await AuthService.getUserProfile(uid);
    return profile?.displayName || profile?.email || fallbackEmail || "";
  } catch {
    return fallbackEmail || "";
  }
}

function publicRegistrationActorMatches(teacher: any, context: PublicRegistrationContext) {
  if (!teacher || teacher.isActive === false) return false;
  if (teacher.role !== "superadmin") {
    const teacherCompanyCode = String(teacher.companyCode || teacher.centerId || "").trim().toUpperCase();
    const teacherBranchId = String(teacher.branchId || "").trim();
    if (teacherCompanyCode !== context.companyCode.toUpperCase()) return false;
    if (teacherBranchId && teacherBranchId !== (context.branchId || "")) return false;
  }
  return true;
}

/** Resource indexing is secondary cleanup and must never make an already-completed student deletion fail. */
async function trashStudentResources(companyCode: string | undefined, studentIds: string[]) {
  if (!companyCode || studentIds.length === 0) return;
  const results = await Promise.allSettled(studentIds.flatMap((id) => [
    resourceIndexingService.trashSourceRecordResources(companyCode, "student.profile", id),
    resourceIndexingService.trashSourceRecordResources(companyCode, "student.custom-field", id),
    resourceIndexingService.trashSourceRecordResources(companyCode, "student.face", id),
    resourceIndexingService.trashSourceRecordResources(companyCode, "public.registration", id),
  ]));
  results.filter((result): result is PromiseRejectedResult => result.status === "rejected").forEach((result) => {
    console.error("Failed to remove an indexed student resource:", result.reason);
  });
}

export class StudentController {
  static async previewBulk(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let ownerId: string | string[];
      if (req.user!.role === "superadmin") {
        const companyCode = req.query.companyCode || req.query.centerId || req.body.companyCode || req.body.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          return res.status(400).json({ success: false, error: "Vui long chon cong ty." });
        }
        ownerId = await getCenterOwnerIds({ uid: companyCode, role: "admin", centerId: companyCode, companyCode });
      } else {
        ownerId = await getCenterOwnerIds(req.user!);
      }

      const students = req.body.students;
      if (!Array.isArray(students)) {
        return res.status(400).json({ success: false, error: "Du lieu hoc vien khong hop le." });
      }
      const result = await StudentService.previewBulkStudents(ownerId, students, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getLearningHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentLearningHistoryService.getHistory(ownerId, req.params.id, req.user!.branchId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      if (["admin", "manager", "branch_owner"].includes(req.user!.role)) {
        requireStudentBranch(req.user!);
      }
      let ownerId = req.user!.uid;
      let centerOwnerIds: string | string[] = "ALL";

      if (req.user!.role === "superadmin") {
        const companyCode = req.body.companyCode || req.body.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          return res.status(400).json({ success: false, error: "Vui long chon cong ty." });
        }
        ownerId = await resolveCreateOwnerId(req.user!, companyCode);
        centerOwnerIds = await getCenterOwnerIds({ uid: companyCode, role: "admin", centerId: companyCode, companyCode });
      } else {
        ownerId = await resolveCreateOwnerId(req.user!);
        centerOwnerIds = await getCenterOwnerIds(req.user!);
      }

      const student = await StudentService.createStudent(ownerId, centerOwnerIds, { ...req.body, branchId: req.user!.branchId }, {
        tenantId: req.user!.role === "superadmin" ? await resolveCustomFieldTenantForOwner(ownerId) : (req.user!.companyCode || req.user!.centerId),
        moduleKey: "students",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      }, {
        uid: req.user!.uid,
        name: await resolveActorName(req.user!.uid, req.user!.email),
      });
      res.status(201).json({ success: true, data: student });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await StudentService.getStudents(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getUnassignedList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds({ ...req.user!, branchId: undefined });
      const result = await StudentService.getUnassignedStudents(ownerId, req.query);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async assignBranch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const companyCode = req.user!.companyCode || req.user!.centerId;
      const ownerId = await getAllowedOwnerIds({ ...req.user!, branchId: undefined });
      const student = await StudentService.assignUnassignedStudentBranch(
        ownerId,
        req.params.id,
        req.body.branchId,
        companyCode,
      );
      if (!student) {
        return res.status(404).json({ success: false, error: "Không tìm thấy dữ liệu chưa gán hoặc chi nhánh hợp lệ." });
      }
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      next(error);
    }
  }
  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const student = await StudentService.getStudentById(ownerId, req.params.id, req.user!.branchId);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien." });
      }
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const centerOwnerIds = await getCenterOwnerIds(req.user!);
      const student = await StudentService.updateStudent(ownerId, centerOwnerIds, req.params.id, req.body, {
        tenantId: req.user!.companyCode || req.user!.centerId,
        moduleKey: "students",
        actorRole: req.user!.role,
        actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId,
      }, req.user!.branchId);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien de cap nhat." });
      }
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      const status = typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 400;
      res.status(status).json({ success: false, error: msg });
    }
  }

  static async getInstallments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const installments = await StudentService.getStudentInstallments(ownerId, req.params.id, req.user!.branchId);
      if (!installments) return res.status(404).json({ success: false, error: "Không tìm thấy học viên." });
      res.json({ success: true, data: installments });
    } catch (error) {
      next(error);
    }
  }

  static async createInstallment(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const installment = await StudentService.createStudentInstallment(ownerId, req.params.id, req.body, req.user!.branchId);
      if (!installment) return res.status(404).json({ success: false, error: "Không tìm thấy học viên." });
      res.status(201).json({ success: true, data: installment });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Lỗi không xác định.";
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 400;
      res.status(status).json({ success: false, error: message });
    }
  }

  static async updateInstallment(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const installment = await StudentService.updateStudentInstallment(
        ownerId,
        req.params.id,
        Number(req.params.no),
        req.body,
        req.user!.branchId,
      );
      if (!installment) return res.status(404).json({ success: false, error: "Không tìm thấy học viên." });
      res.json({ success: true, data: installment });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Lỗi không xác định.";
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 400;
      res.status(status).json({ success: false, error: message });
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const student = await StudentService.deleteStudent(ownerId, req.params.id, req.user!.branchId);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien de xoa." });
      }
      const companyCode = req.user!.companyCode || req.user!.centerId;
      await trashStudentResources(companyCode, [String(student._id)]);
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const ids = req.body.ids || req.body.studentIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "Vui long chon it nhat mot hoc vien de xoa." });
      }
      const result = await StudentService.bulkDeleteStudents(ownerId, ids, req.user!.branchId);
      const companyCode = req.user!.companyCode || req.user!.centerId;
      await trashStudentResources(companyCode, result.deletedIds);
      res.json({ success: true, message: `Da xoa thanh cong ${result.deletedCount} hoc vien.`, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async previewBulkDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const ids = req.body.ids || req.body.studentIds;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "Vui long chon it nhat mot hoc vien de xoa." });
      }
      const impact = await StudentService.getDeletionImpact(ownerId, ids, req.user!.branchId);
      res.json({
        success: true,
        ...impact,
        deletableCount: impact.deletableIds.length,
        blockedCount: impact.blockedIds.length,
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async bulkCreate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const creatorId = req.user!.uid;
      let ownerId: string | string[];
      let targetOwnerId: string | undefined;
      let resourceCompanyCode = req.user!.companyCode;

      if (req.user!.role === "superadmin") {
        const companyCode = req.query.companyCode || req.query.centerId || req.body.companyCode || req.body.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          return res.status(400).json({ success: false, error: "Vui long chon cong ty." });
        }
        resourceCompanyCode = companyCode.trim().toUpperCase();
        // Student.ownerId stores the actual owner user id, not the company code.
        // Keep bulk import consistent with manual creation and with owner filters.
        targetOwnerId = await resolveCreateOwnerId(req.user!, companyCode);
        ownerId = await getCenterOwnerIds({ uid: companyCode, role: "admin", centerId: companyCode, companyCode });
      } else {
        targetOwnerId = await resolveCreateOwnerId(req.user!);
        ownerId = await getCenterOwnerIds(req.user!);
      }

      const students = req.body.students;
      if (!Array.isArray(students)) {
        return res.status(400).json({ success: false, error: "Du lieu hoc vien khong hop le." });
      }

      const creatorName = await resolveActorName(creatorId, req.user!.email);
      const result = await StudentService.bulkCreateStudents(creatorId, ownerId, students, targetOwnerId, req.user!.branchId, creatorName);
      if (req.body.importUpload?.uploadToken && req.body.importUpload?.fileName) {
        await importResourceService.recordSuccessfulImport({
          companyCode: resourceCompanyCode,
          branchId: req.user!.branchId,
          actorId: creatorId,
          actorName: creatorName,
        }, {
          sourceType: "import.student",
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

  /**
   * Mint a signed public registration context from the authenticated user's scope.
   * The public page never chooses its company or branch from editable URL fields.
   */
  static async createPublicRegistrationLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const actor = req.user!;
      const rawRequestedCompanyCode = String(req.body.companyCode || "").trim().toUpperCase();
      const requestedCompanyCode = rawRequestedCompanyCode === "ALL" ? "" : rawRequestedCompanyCode;
      const actorCompanyCode = String(actor.companyCode || actor.centerId || "").trim().toUpperCase();
      const companyCode = actor.role === "superadmin" ? requestedCompanyCode : actorCompanyCode;

      if (!companyCode || companyCode === "ALL" || (actor.role !== "superadmin" && requestedCompanyCode && requestedCompanyCode !== actorCompanyCode)) {
        throw new ValidationError("PUBLIC_REGISTRATION_SCOPE_INVALID", "Không thể tạo liên kết đăng ký cho công ty đã chọn.");
      }

      if (actor.role === "superadmin" && !await User.exists({ companyCode, role: { $ne: "superadmin" }, isActive: { $ne: false } })) {
        throw new ValidationError("PUBLIC_REGISTRATION_SCOPE_INVALID", "Không tìm thấy công ty đang hoạt động.");
      }

      const requestedBranchId = String(req.body.branchId || "").trim();
      const assignedBranchId = String(actor.branchId || "").trim();
      if (assignedBranchId && requestedBranchId && requestedBranchId !== assignedBranchId) {
        throw new ValidationError("PUBLIC_REGISTRATION_SCOPE_INVALID", "Tài khoản này chỉ được tạo liên kết cho chi nhánh đã gán.");
      }
      const branchId = assignedBranchId || requestedBranchId || undefined;
      if (branchId) {
        if (!/^[a-f\d]{24}$/i.test(branchId) || !await BranchModel.exists({ _id: branchId, companyCode, isActive: true })) {
          throw new ValidationError("PUBLIC_REGISTRATION_SCOPE_INVALID", "Chi nhánh không tồn tại, đã ngừng hoạt động hoặc không thuộc công ty đã chọn.");
        }
      }

      const registrationToken = createPublicRegistrationToken({
        teacherId: actor.uid,
        companyCode,
        ...(branchId ? { branchId } : {}),
        ...(req.body.entityPreset ? { entityPreset: req.body.entityPreset } : {}),
      });
      res.status(201).json({ success: true, data: { registrationToken } });
    } catch (error: unknown) {
      next(error);
    }
  }

  /**
   * Chặn request upload không có token đăng ký hợp lệ. Middleware chạy TRƯỚC multer
   * để request giả mạo không đẩy tệp lên Cloudinary.
   */
  static async assertPublicTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const context = verifyPublicRegistrationToken(req.query.registrationToken);
      const teacher = await AuthService.getUserProfile(context.teacherId);
      if (!publicRegistrationActorMatches(teacher, context)) {
        return res.status(400).json({ success: false, error: "Liên kết đăng ký không hợp lệ hoặc đã hết hạn. Hãy xin mã QR mới." });
      }
      next();
    } catch {
      res.status(400).json({ success: false, error: "Liên kết đăng ký không hợp lệ hoặc đã hết hạn. Hãy xin mã QR mới." });
    }
  }

  /**
   * Upload ảnh CCCD/chân dung cho form đăng ký công khai. Không cần đăng nhập nên
   * chỉ nhận đúng 1 ảnh mỗi lần, giới hạn dung lượng theo cấu hình multer.
   */
  static async publicUpload(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ success: false, error: "Không tìm thấy tệp tin nào được gửi." });
    }
    try {
      const context = verifyPublicRegistrationToken(req.query.registrationToken);
      const teacher = await AuthService.getUserProfile(context.teacherId);
      if (!publicRegistrationActorMatches(teacher, context)) throw new Error("Liên kết đăng ký không hợp lệ hoặc đã hết hạn.");
      const pending = await managedUploadService.recordPendingStoredAsset({
        companyCode: context.companyCode,
        branchId: context.branchId,
        actorId: context.teacherId,
        actorName: teacher.displayName || teacher.email,
        trusted: true,
      }, {
        sourceType: "public.registration",
        fileName: Buffer.from(file.originalname, "latin1").toString("utf8"),
        fileUrl: file.path,
        mimeType: file.mimetype,
        size: file.size,
        storageProvider: "cloudinary",
        storagePublicId: String((file as any).filename || ""),
        storageResourceType: file.mimetype === "application/pdf" ? "raw" : "image",
      });
      res.status(200).json({
        success: true,
        data: { url: file.path, name: pending.fileName, type: file.mimetype, uploadToken: pending.token },
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Không thể ghi nhận tệp tải lên." });
    }
  }

  /**
   * Cấu hình để trang đăng ký công khai dựng form giống hệt popup thêm học viên:
   * nhãn/placeholder/bắt buộc/ẩn-hiện do công ty tự chỉnh, cộng với loại hình
   * doanh nghiệp (học viên / lao động / khách hàng) để lấy đúng bộ chữ.
   */
  static async publicRegisterConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const context = verifyPublicRegistrationToken(req.query.registrationToken);
      const teacher = await AuthService.getUserProfile(context.teacherId);
      if (!publicRegistrationActorMatches(teacher, context)) {
        return res.status(400).json({ success: false, error: "Liên kết đăng ký không hợp lệ hoặc đã hết hạn. Hãy xin mã QR mới." });
      }

      const targetCompanyCode = context.companyCode;
      const tenantId = await resolveCustomFieldTenantForOwner(targetCompanyCode);
      const partnerOwnerIds = await getCenterOwnerIds({
        uid: targetCompanyCode,
        role: "admin",
        centerId: targetCompanyCode,
        companyCode: targetCompanyCode,
        branchId: context.branchId,
      });
      const settings = await new ModuleSettingsService().get(tenantId);
      const entityPreset = context.entityPreset === "worker" || settings.entityPreset === "worker"
        ? "worker"
        : context.entityPreset || settings.entityPreset;
      const [fields, partners] = await Promise.all([
        resolvePublicRegisterFields(tenantId, entityPreset),
        Partner.find({
          ownerId: Array.isArray(partnerOwnerIds) ? { $in: partnerOwnerIds } : partnerOwnerIds,
          isActive: true,
          ...(context.branchId ? { branchId: context.branchId } : {}),
        })
          .select("_id name phone")
          .sort({ name: 1 })
          .lean(),
      ]);

      res.json({
        success: true,
        data: {
          fields,
          entityPreset,
          partners: partners.map((p) => ({ _id: String(p._id), name: p.name, phone: p.phone })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async publicRegister(req: Request, res: Response) {
    try {
      const {
        registrationToken,
        partnerCode,
        ...studentData
      } = req.body;
      const context = verifyPublicRegistrationToken(registrationToken);
      const teacher = await AuthService.getUserProfile(context.teacherId);
      if (!publicRegistrationActorMatches(teacher, context)) {
        return res.status(400).json({ success: false, error: "Liên kết đăng ký không hợp lệ hoặc đã hết hạn. Hãy xin mã QR mới." });
      }

      const targetCompanyCode = context.companyCode;
      const targetBranchId = context.branchId;
      const tenantId = await resolveCustomFieldTenantForOwner(targetCompanyCode);
      const settings = await new ModuleSettingsService().get(tenantId);
      const entityPreset = context.entityPreset === "worker" || settings.entityPreset === "worker"
        ? "worker"
        : context.entityPreset || settings.entityPreset;
      const missing = await findMissingPublicRegisterFields(tenantId, studentData, entityPreset);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Vui lòng điền: ${missing.join(", ")}.`,
        });
      }

      if (entityPreset === "worker") {
        // Mã đối tác giới thiệu do người đăng ký tự nhập nên phải đối chiếu trước khi
        // tạo hồ sơ, tránh để lại hồ sơ mồ côi khi mã sai.
        const referralPartnerCode = String(partnerCode || "").trim().toUpperCase();
        if (referralPartnerCode) {
          const partner = await LaborPartnerModel.exists({
            code: referralPartnerCode,
            companyCode: targetCompanyCode,
            ...(targetBranchId ? { branchId: targetBranchId } : {}),
            status: "active",
            deletedAt: null,
          });
          if (!partner) {
            return res.status(400).json({
              success: false,
              error: `Không tìm thấy đối tác giới thiệu có mã ${referralPartnerCode}. Vui lòng kiểm tra lại hoặc bỏ trống.`,
            });
          }
        }

        const worker = await WorkerService.create(
          {
            companyCode: targetCompanyCode,
            ...(targetBranchId ? { branchId: targetBranchId } : {}),
          },
          {
            ...studentData,
            registrationDate: new Date().toLocaleDateString("vi-VN"),
            status: "active",
          },
        );
        await sourceUploadFinalizer.finalize({
          companyCode: targetCompanyCode,
          branchId: targetBranchId,
          actorId: context.teacherId,
          actorName: teacher.displayName || teacher.email,
          trusted: true,
        }, {
          entityType: "worker",
          entityId: String(worker._id),
          entityLabel: worker.fullName || String(worker._id),
          sourceRecordId: String(worker._id),
          uploads: ["idCardFrontFile", "idCardBackFile", "portraitFile"].map((field) => ({
            uploadToken: (studentData as any)[field]?.uploadToken,
            sourceField: field,
          })),
        });
        let referralWarning = "";
        if (referralPartnerCode) {
          try {
            await WorkerReferralService.createForImportedWorker(
              { companyCode: targetCompanyCode, ...(targetBranchId ? { branchId: targetBranchId } : {}) } as any,
              {
                workerId: String(worker._id),
                partnerCode: referralPartnerCode,
                registrationDate: worker.registrationDate,
              },
              { id: context.teacherId, name: teacher.displayName || teacher.email },
            );
          } catch (referralError) {
            // Hồ sơ đã lưu thành công, chỉ phần gắn đối tác lỗi (thường do thiếu
            // chính sách hoa hồng). Nhân viên sẽ gắn lại trong phân hệ Đối tác lao động.
            referralWarning = referralError instanceof Error
              ? referralError.message
              : "Không gắn được đối tác giới thiệu.";
          }
        }
        return res.status(201).json({ success: true, data: worker, ...(referralWarning ? { warning: referralWarning } : {}) });
      }

      let ownerId = context.teacherId;
      let teacherScope: string | string[] = "ALL";
      const teacherUser = {
        uid: context.teacherId,
        role: teacher.role,
        centerId: targetCompanyCode,
        companyCode: targetCompanyCode,
        branchId: targetBranchId,
      };
      if (teacher.role === "superadmin") {
        ownerId = await resolveCreateOwnerId(teacherUser, targetCompanyCode);
        teacherScope = await getCenterOwnerIds({ uid: targetCompanyCode, role: "admin", centerId: targetCompanyCode, companyCode: targetCompanyCode, branchId: targetBranchId });
      } else {
        ownerId = await resolveCreateOwnerId(teacherUser);
        teacherScope = await getCenterOwnerIds(teacherUser);
      }

      const payload = {
        ...studentData,
        registrationDate: new Date().toLocaleDateString("vi-VN"),
        fee: "0",
        paidAmount: 0,
        status: ["Đang học"],
        centerId: targetCompanyCode,
        partnerId: studentData.partnerId ? String(studentData.partnerId).trim() : undefined,
      };

      if (payload.partnerId) {
        const partnerOwnerQuery = Array.isArray(teacherScope)
          ? { ownerId: { $in: teacherScope } }
          : teacherScope === "ALL" ? {} : { ownerId: teacherScope };
        const partner = await Partner.findOne({
          _id: payload.partnerId,
          ...partnerOwnerQuery,
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
          isActive: true,
        }).select("_id");
        if (!partner) {
          return res.status(400).json({ success: false, error: "Đối tác giới thiệu không hợp lệ hoặc không thuộc phạm vi đăng ký." });
        }
      }

      // Public registration has no dynamic-field UI and is intentionally exempt
      // from admin-form custom-field requirements.
      const student = await StudentService.createStudent(
        ownerId,
        teacherScope,
        { ...payload, branchId: targetBranchId },
        undefined,
        { uid: context.teacherId, name: teacher.displayName || teacher.email || "" },
      );

      if ((studentData as any).idCardFrontFile || (studentData as any).idCardBackFile || (studentData as any).portraitFile) {
        await sourceUploadFinalizer.finalize({
          companyCode: targetCompanyCode,
          branchId: targetBranchId,
          actorId: context.teacherId,
          actorName: teacher.displayName || teacher.email,
          trusted: true,
        }, {
          entityType: "student",
          entityId: String(student._id),
          entityLabel: student.fullName || String(student._id),
          sourceRecordId: String(student._id),
          uploads: ["idCardFrontFile", "idCardBackFile", "portraitFile"].map((field) => ({
            uploadToken: (studentData as any)[field]?.uploadToken,
            sourceField: field,
          })),
        });
      }

      res.status(201).json({ success: true, data: student });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async markInstallmentPaid(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { id, no } = req.params;
      const installmentNo = parseInt(no, 10);

      if (isNaN(installmentNo) || installmentNo < 1) {
        return res.status(400).json({ success: false, error: "So dot khong hop le." });
      }

      const result = await StudentService.markInstallmentPaid(ownerId, id, installmentNo, req.user!.branchId);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      res.json({ success: true, message: `Da danh dau da thu dot ${installmentNo}.` });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async publicLookup(req: Request, res: Response) {
    try {
      const { idCard } = req.query;
      if (!idCard || typeof idCard !== "string") {
        return res.status(400).json({ success: false, error: "Vui long nhap so CCCD." });
      }

      const student = await StudentService.getStudentByIdCard(idCard.trim());
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay thong tin hoc vien." });
      }

      // Endpoint không yêu cầu đăng nhập: chỉ trả về các trường cần thiết để tra cứu
      // công khai, tuyệt đối không lộ PII nhạy cảm (SĐT, địa chỉ, học phí, thanh toán...).
      const publicData = {
        fullName: student.fullName,
        status: student.status,
        courseId: student.courseId,
        progress: student.progress,
      };

      res.json({ success: true, data: publicData });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
