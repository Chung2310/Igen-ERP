import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Student } from "../models/student.model";
import {
  studentFaceService,
  InsightFaceBusinessError,
  InsightFaceUnavailableError,
} from "../services/student-face.service";

type UploadRequest = AuthRequest & { file?: Express.Multer.File };

async function findAllowedStudent(req: AuthRequest) {
  const allowedOwners = await getAllowedOwnerIds(req.user!);
  const query: Record<string, unknown> = { _id: req.params.studentId };
  if (allowedOwners !== "ALL") {
    query.ownerId = Array.isArray(allowedOwners) ? { $in: allowedOwners } : allowedOwners;
  }
  return Student.findOne(query);
}

export class StudentFaceController {
  static async status(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const student = await findAllowedStudent(req);
      if (!student) {
        return res.status(404).json({ success: false, error: "Không tìm thấy học viên hoặc bạn không có quyền." });
      }
      const result = await studentFaceService.getStatus(student.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async register(req: UploadRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, reasonCode: "invalid_image" });
      }
      const student = await findAllowedStudent(req);
      if (!student) {
        return res.status(404).json({ success: false, error: "Không tìm thấy học viên hoặc bạn không có quyền." });
      }
      const result = await studentFaceService.register(req.user!.id, student, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof InsightFaceBusinessError) {
        return res.status(400).json({ success: false, reasonCode: error.reasonCode });
      }
      if (error instanceof InsightFaceUnavailableError) {
        return res.status(503).json({ success: false, reasonCode: "model_unavailable" });
      }
      next(error);
    }
  }

  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const student = await findAllowedStudent(req);
      if (!student) {
        return res.status(404).json({ success: false, error: "Không tìm thấy học viên hoặc bạn không có quyền." });
      }
      await studentFaceService.remove(req.user!.id, student);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof InsightFaceBusinessError) {
        return res.status(400).json({ success: false, reasonCode: error.reasonCode });
      }
      if (error instanceof InsightFaceUnavailableError) {
        return res.status(503).json({ success: false, reasonCode: "model_unavailable" });
      }
      next(error);
    }
  }
}
