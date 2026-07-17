import { Request, Response, NextFunction } from "express";
import { StudentService } from "../services/student.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AuthService } from "../services/auth.service";
import { getAllowedOwnerIds, getCenterOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class StudentController {
  static async create(req: AuthRequest, res: Response) {
    try {
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
        centerOwnerIds = await getCenterOwnerIds(req.user!);
      }

      const student = await StudentService.createStudent(ownerId, centerOwnerIds, req.body);
      res.status(201).json({ success: true, data: student });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await StudentService.getStudents(ownerId, req.query);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const student = await StudentService.getStudentById(ownerId, req.params.id);
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
      const student = await StudentService.updateStudent(ownerId, centerOwnerIds, req.params.id, req.body);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien de cap nhat." });
      }
      res.json({ success: true, data: student });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Loi khong xac dinh.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const student = await StudentService.deleteStudent(ownerId, req.params.id);
      if (!student) {
        return res.status(404).json({ success: false, error: "Khong tim thay hoc vien de xoa." });
      }
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
      const deletedCount = await StudentService.bulkDeleteStudents(ownerId, ids);
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

      if (req.user!.role === "superadmin") {
        const companyCode = req.query.companyCode || req.query.centerId || req.body.companyCode || req.body.centerId;
        if (!companyCode || typeof companyCode !== "string") {
          return res.status(400).json({ success: false, error: "Vui long chon cong ty." });
        }
        // Student.ownerId stores the actual owner user id, not the company code.
        // Keep bulk import consistent with manual creation and with owner filters.
        targetOwnerId = await resolveCreateOwnerId(req.user!, companyCode);
        ownerId = await getCenterOwnerIds({ uid: companyCode, role: "admin", centerId: companyCode, companyCode });
      } else {
        ownerId = await getCenterOwnerIds(req.user!);
      }

      const students = req.body.students;
      if (!Array.isArray(students)) {
        return res.status(400).json({ success: false, error: "Du lieu hoc vien khong hop le." });
      }

      const result = await StudentService.bulkCreateStudents(creatorId, ownerId, students, targetOwnerId);
      res.status(200).json({ success: true, ...result });
    } catch (error: unknown) {
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

      const student = await StudentService.createStudent(teacherId, teacherScope, payload);
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

      const result = await StudentService.markInstallmentPaid(ownerId, id, installmentNo);
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
