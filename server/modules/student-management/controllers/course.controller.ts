import { Response, NextFunction } from "express";
import { CourseService } from "../services/course.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class CourseController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string" ? req.body.companyCode : undefined
      );
      const course = await CourseService.createCourse(ownerId, req.body);
      res.status(201).json({ success: true, data: course });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await CourseService.getCourses(ownerId, req.query);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const course = await CourseService.getCourseById(ownerId, req.params.id);
      if (!course) {
        return res.status(404).json({ success: false, error: "Không tìm thấy khóa học." });
      }
      res.json({ success: true, data: course });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const course = await CourseService.updateCourse(ownerId, req.params.id, req.body);
      if (!course) {
        return res.status(404).json({ success: false, error: "Không tìm thấy khóa học để cập nhật." });
      }
      res.json({ success: true, data: course });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const course = await CourseService.deleteCourse(ownerId, req.params.id);
      if (!course) {
        return res.status(404).json({ success: false, error: "Không tìm thấy khóa học để xóa." });
      }
      res.json({ success: true, data: course });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
