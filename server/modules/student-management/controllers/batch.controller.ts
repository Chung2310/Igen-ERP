import { Response, NextFunction } from "express";
import { BatchService } from "../services/batch.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class BatchController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const batch = await BatchService.createBatch(ownerId, req.user!, req.body);
      res.status(201).json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await BatchService.getBatches(ownerId, req.query);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.getBatchById(ownerId, req.params.id);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học." });
      }
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.updateBatch(ownerId, req.user!, req.params.id, req.body);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học để cập nhật." });
      }
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.deleteBatch(ownerId, req.params.id);
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
      const batch = await BatchService.addLearner(ownerId, req.params.id, req.body.studentId, businessType);
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async removeLearner(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const batch = await BatchService.removeLearner(ownerId, req.params.id, req.params.studentId);
      res.json({ success: true, data: batch });
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
      const batch = await BatchService.saveAttendanceSession(ownerId, req.params.id, date, records, note);
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
      const batch = await BatchService.deleteAttendanceSessionByDate(ownerId, req.params.id, String(date));
      res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
