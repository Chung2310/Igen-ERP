import { Response, NextFunction } from "express";
import { BatchService, listBatchEnrollments, updateEnrollmentStatus } from "../services/batch.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId, requireStudentBranch } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";

export class BatchController {
  static async create(req: AuthRequest, res: Response) {
    try {
      if (["admin", "manager", "branch_owner"].includes(req.user!.role)) {
        requireStudentBranch(req.user!);
      }
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const batch = await BatchService.createBatch(ownerId, req.user!, { ...req.body, branchId: req.user!.branchId }, {
        tenantId: req.user!.role === "superadmin" ? await resolveCustomFieldTenantForOwner(ownerId) : (req.user!.companyCode || req.user!.centerId),
        moduleKey: "batches",
        actorRole: req.user!.role,
      });
      res.status(201).json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await BatchService.getBatches(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.getBatchById(ownerId, req.params.id, req.user!.branchId);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học." });
      }
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      next(error);
    }
  }

  /** Sổ buổi học của các học viên trong lớp */
  static async getEnrollments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Đi qua getBatchById để giữ nguyên kiểm tra owner + chi nhánh
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.getBatchById(ownerId, req.params.id, req.user!.branchId);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học." });
      }
      const data = await listBatchEnrollments(ownerId, req.params.id, req.user!.branchId);
      res.json({ success: true, data });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.updateBatch(ownerId, req.user!, req.params.id, req.body, {
        tenantId: req.user!.companyCode || req.user!.centerId,
        moduleKey: "batches",
        actorRole: req.user!.role,
      }, req.user!.branchId);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học để cập nhật." });
      }
      res.json({ success: true, data: batch });
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
      const batch = await BatchService.deleteBatch(ownerId, req.params.id, req.user!.branchId);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học để xóa." });
      }
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async addLearner(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const businessType = "general";
      const batch = await BatchService.addLearner(ownerId, req.params.id, req.body.studentId, businessType, req.user!.branchId, req.user!.uid);
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async removeLearner(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.removeLearner(ownerId, req.params.id, req.params.studentId, req.user!.branchId, req.user!.uid);
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  /** Bảo lưu hoặc tiếp tục học mà không đổi sổ buổi. */
  static async updateEnrollmentStatus(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { status, reason, expectedReturnAt, retakeFee, targetBatchId } = req.body;
      const enrollment = await updateEnrollmentStatus(
        ownerId, req.params.id, req.params.studentId, status, reason, expectedReturnAt, req.user!.branchId, retakeFee, targetBatchId, req.user!.uid,
      );
      if (!enrollment) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học." });
      }
      res.json({ success: true, data: enrollment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async saveAttendance(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { date, records, note } = req.body;
      if (!date) {
        return res.status(400).json({ success: false, error: "Vui lòng truyền ngày điểm danh." });
      }
      const batch = await BatchService.saveAttendanceSession(ownerId, req.params.id, date, records, note, req.user!.branchId);
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async deleteAttendanceByDate(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp ngày cần xóa điểm danh." });
      }
      const batch = await BatchService.deleteAttendanceSessionByDate(ownerId, req.params.id, String(date), req.user!.branchId);
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
