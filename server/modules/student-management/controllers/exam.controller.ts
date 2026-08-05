import { Response, NextFunction } from "express";
import { ExamService } from "../services/exam.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId, requireStudentBranch } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";

export class ExamController {
  static async create(req: AuthRequest, res: Response) {
    try {
      if (["admin", "manager", "branch_owner"].includes(req.user!.role)) {
        requireStudentBranch(req.user!);
      }
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const exam = await ExamService.createExam(ownerId, { ...req.body, branchId: req.user!.branchId }, {
        tenantId: req.user!.role === "superadmin" ? await resolveCustomFieldTenantForOwner(ownerId) : (req.user!.companyCode || req.user!.centerId),
        moduleKey: "exams",
        actorRole: req.user!.role,
      });
      res.status(201).json({ success: true, data: exam });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await ExamService.getExams(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const exam = await ExamService.getExamById(ownerId, req.params.id, req.user!.branchId);
      if (!exam) {
        return res.status(404).json({ success: false, error: "Không tìm thấy kỳ thi." });
      }
      res.json({ success: true, data: exam });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const exam = await ExamService.updateExam(ownerId, req.params.id, req.body, {
        tenantId: req.user!.companyCode || req.user!.centerId,
        moduleKey: "exams",
        actorRole: req.user!.role,
      }, req.user!.branchId);
      if (!exam) {
        return res.status(404).json({ success: false, error: "Không tìm thấy kỳ thi để cập nhật." });
      }
      res.json({ success: true, data: exam });
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
      const exam = await ExamService.deleteExam(ownerId, req.params.id, req.user!.branchId);
      if (!exam) {
        return res.status(404).json({ success: false, error: "Không tìm thấy kỳ thi để xóa." });
      }
      res.json({ success: true, data: exam });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async assign(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { studentId, studentIds } = req.body;
      const examId = req.params.id;
      const idsToAssign = studentIds || (studentId ? [studentId] : []);
      
      if (idsToAssign.length === 0) {
        return res.status(400).json({ success: false, error: "Thiếu ID học viên." });
      }

      await ExamService.assignStudents(ownerId, examId, idsToAssign, req.user!.branchId);
      res.json({ success: true, message: "Đã thêm học viên vào kỳ thi thành công." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async unassign(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { studentId } = req.body;
      const examId = req.params.id;
      
      if (!studentId) {
        return res.status(400).json({ success: false, error: "Thiếu ID học viên." });
      }

      await ExamService.unassignStudent(ownerId, examId, studentId, req.user!.branchId);
      res.json({ success: true, message: "Đã xóa học viên khỏi kỳ thi thành công." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async updateStudentResult(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const { overallResult } = req.body;
      const examId = req.params.id;
      const { studentId } = req.params;

      if (!overallResult) {
        return res.status(400).json({ success: false, error: "Thiếu kết quả thi." });
      }

      await ExamService.updateStudentResult(ownerId, examId, studentId, overallResult, req.user!.branchId);
      res.json({ success: true, message: "Cập nhật kết quả thi học viên thành công." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async gradeResults(req: AuthRequest, res: Response) {
    try {
      const data = await ExamService.gradeResults(await getAllowedOwnerIds(req.user!), req.params.id, req.body.results, req.user!.uid, req.user!.branchId);
      res.json({ success: true, data });
    } catch (error: unknown) {
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Không thể lưu điểm thi." });
    }
  }

  static async importResults(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const examId = req.params.id;
      const { results, preview } = req.body;

      if (!results || !Array.isArray(results)) {
        return res.status(400).json({ success: false, error: "Dữ liệu kết quả không hợp lệ." });
      }

      const outcome = await ExamService.importResults(ownerId, examId, results, !!preview, req.user!.branchId);
      res.json({ 
        success: true, 
        message: preview ? "Xem trước kết quả nhập thành công." : "Nhập kết quả thi hàng loạt thành công.",
        ...outcome
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
