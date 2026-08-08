import { Request, Response, NextFunction } from "express";
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

export class StudentController {
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

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const student = await StudentService.deleteStudent(ownerId, req.params.id, req.user!.branchId);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien de xoa." });
      }
      const companyCode = req.user!.companyCode || req.user!.centerId;
      await Promise.all([
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.profile", String(student._id)),
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.custom-field", String(student._id)),
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.face", String(student._id)),
        resourceIndexingService.trashSourceRecordResources(companyCode, "public.registration", String(student._id)),
      ]);
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async bulkDelete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "Vui long chon it nhat mot hoc vien de xoa." });
      }
      const deletedCount = await StudentService.bulkDeleteStudents(ownerId, ids, req.user!.branchId);
      const companyCode = req.user!.companyCode || req.user!.centerId;
      await Promise.all(ids.flatMap((id: string) => [
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.profile", id),
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.custom-field", id),
        resourceIndexingService.trashSourceRecordResources(companyCode, "student.face", id),
        resourceIndexingService.trashSourceRecordResources(companyCode, "public.registration", id),
      ]));
      res.json({ success: true, message: `Da xoa thanh cong ${deletedCount} hoc vien.`, deletedCount });
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
   * Chặn cửa cho các endpoint đăng ký công khai: chỉ cho đi tiếp khi ?teacherId=
   * trỏ tới một giáo viên đang hoạt động. Chạy TRƯỚC multer để request rác không
   * kịp đẩy file lên Cloudinary.
   */
  static async assertPublicTeacher(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : "";
      if (!teacherId) {
        return res.status(400).json({ success: false, error: "Thiếu mã giáo viên trong đường dẫn đăng ký." });
      }
      const teacher = await AuthService.getUserProfile(teacherId);
      if (!teacher || teacher.isActive === false) {
        return res.status(400).json({ success: false, error: "Giáo viên không hợp lệ hoặc đã bị khóa." });
      }
      next();
    } catch {
      res.status(400).json({ success: false, error: "Không xác thực được giáo viên." });
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
      const teacherId = String(req.query.teacherId || "");
      const teacher = await AuthService.getUserProfile(teacherId);
      if (!teacher) throw new Error("Giáo viên không hợp lệ.");
      const pending = await managedUploadService.recordPendingStoredAsset({
        companyCode: teacher.companyCode || teacher.centerId,
        branchId: teacher.branchId,
        actorId: teacherId,
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
      const teacherId = String(req.query.teacherId);
      const teacher = await AuthService.getUserProfile(teacherId);
      if (!teacher || teacher.isActive === false) {
        return res.status(400).json({ success: false, error: "Giáo viên không hợp lệ hoặc đã bị khóa." });
      }

      const tenantId = await resolveCustomFieldTenantForOwner(teacher.companyCode || teacher.centerId || teacherId);
      const [fields, settings] = await Promise.all([
        resolvePublicRegisterFields(tenantId),
        new ModuleSettingsService().get(tenantId),
      ]);

      res.json({ success: true, data: { fields, entityPreset: settings.entityPreset } });
    } catch (error) {
      next(error);
    }
  }

  static async publicRegister(req: Request, res: Response) {
    try {
      const { teacherId, ...studentData } = req.body;
      const teacher = await AuthService.getUserProfile(teacherId);
      if (!teacher || teacher.isActive === false) {
        return res.status(400).json({ success: false, error: "Giao vien khong hop le hoac da bi khoa." });
      }

      const tenantId = await resolveCustomFieldTenantForOwner(
        teacher.companyCode || teacher.centerId || teacherId,
      );
      const missing = await findMissingPublicRegisterFields(tenantId, studentData);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Vui lòng điền: ${missing.join(", ")}.`,
        });
      }

      const payload = {
        ...studentData,
        registrationDate: new Date().toLocaleDateString("vi-VN"),
        fee: "0",
        paidAmount: 0,
        status: "Dang hoc",
      };

      const teacherScope =
        teacher.role === "superadmin"
          ? "ALL"
          : await getCenterOwnerIds({
              uid: teacherId,
              role: teacher.role,
              centerId: teacher.companyCode || teacher.centerId || "",
              companyCode: teacher.companyCode || teacher.centerId,
            });

      // Public registration has no dynamic-field UI and is intentionally exempt
      // from admin-form custom-field requirements.
      const student = await StudentService.createStudent(
        teacherId,
        teacherScope,
        { ...payload, branchId: teacher.branchId },
        undefined,
        { uid: teacherId, name: teacher.displayName || teacher.email || "" },
      );
      await sourceUploadFinalizer.finalize({
        companyCode: teacher.companyCode || teacher.centerId,
        branchId: teacher.branchId,
        actorId: teacherId,
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
