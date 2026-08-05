import { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { StudentQualityService } from "../services/student-quality.service";

export class StudentQualityController {
  static async getThresholds(req: AuthRequest, res: Response, next: NextFunction) {
    try { const ownerId = await getAllowedOwnerIds(req.user!); res.json({ success: true, data: await StudentQualityService.getThresholds(ownerId, req.user!.branchId) }); } catch (error) { next(error); }
  }

  static async updateThresholds(req: AuthRequest, res: Response, next: NextFunction) {
    try { const ownerId = await getAllowedOwnerIds(req.user!); res.json({ success: true, data: await StudentQualityService.updateThresholds(ownerId, req.user!.branchId, req.body) }); } catch (error) { next(error); }
  }

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await StudentQualityService.list(ownerId, req.query, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.detail(ownerId, req.params.batchId, req.params.studentId, req.user!.branchId);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể tải dữ liệu chất lượng học viên.";
      res.status(404).json({ success: false, error: message });
    }
  }

  static async updateAssessment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.updateAssessment(ownerId, req.params.batchId, req.params.studentId, req.body, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createMiniTest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.createMiniTest(ownerId, req.params.batchId, req.params.studentId, req.body, req.user!);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async updateMiniTest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.updateMiniTest(ownerId, req.params.batchId, req.params.studentId, req.params.miniTestId, req.body, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMiniTest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.deleteMiniTest(ownerId, req.params.batchId, req.params.studentId, req.params.miniTestId, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async gradeAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const data = await StudentQualityService.gradeAssignment(ownerId, req.params.batchId, req.params.studentId, req.params.assignmentId, req.body, req.user!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
