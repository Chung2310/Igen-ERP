import { Request, Response, NextFunction } from "express";
import { StudentOnlineAttendanceService, OnlineCheckinError } from "../services/student-online-attendance.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Batch } from "../models/batch.model";

type UploadRequest = Request & { file?: Express.Multer.File };

export class StudentOnlineAttendanceController {
  // Sinh mã xác thực + gửi email cho học viên đã đăng ký khuôn mặt trong lớp (GV/Admin)
  static async createSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { batchId, date } = req.body;
      if (!batchId || !date) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp batchId và date." });
      }

      const allowedOwners = await getAllowedOwnerIds(req.user!);
      const query: Record<string, any> = { _id: batchId };
      if (allowedOwners !== "ALL") {
        query.ownerId = Array.isArray(allowedOwners) ? { $in: allowedOwners } : allowedOwners;
      }

      const batch = await Batch.findOne(query);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học hoặc bạn không có quyền." });
      }

      const result = await StudentOnlineAttendanceService.createSessions(req.user!.uid, batch.ownerId, batchId, date);
      res.json({ success: true, ...result });
    } catch (error: any) {
      if (error instanceof OnlineCheckinError) {
        return res.status(400).json({ success: false, error: error.message, reasonCode: error.reasonCode });
      }
      next(error);
    }
  }

  // Học viên xác thực bằng mã + khuôn mặt (PUBLIC, rate-limited)
  static async checkin(req: UploadRequest, res: Response) {
    try {
      const { phone, code, batchId, date } = req.body;
      if (!phone || !code || !batchId || !date) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp đầy đủ thông tin điểm danh." });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Vui lòng chụp ảnh khuôn mặt để điểm danh.", reasonCode: "missing_image" });
      }

      const result = await StudentOnlineAttendanceService.checkin(
        phone, code, batchId, date, req.file.buffer, req.file.mimetype
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof OnlineCheckinError) {
        return res.status(400).json({ success: false, error: error.message, reasonCode: error.reasonCode });
      }
      res.status(400).json({ success: false, error: error.message || "Điểm danh không thành công." });
    }
  }
}
