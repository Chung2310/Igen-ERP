import { Request, Response, NextFunction } from "express";
import { QRAttendanceService } from "../services/qr-attendance.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Batch } from "../models/batch.model";

export class QRAttendanceController {
  // 1. Tạo phiên điểm danh mới (GV/Admin)
  static async createSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { batchId, date, durationMinutes } = req.body;
      if (!batchId || !date) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp batchId và date." });
      }

      // Xác minh quyền: Giảng viên chỉ được tạo phiên cho lớp họ quản lý (ownerId hợp lệ)
      const allowedOwners = await getAllowedOwnerIds(req.user!);
      const query: Record<string, any> = { _id: batchId };
      if (allowedOwners !== "ALL") {
        query.ownerId = Array.isArray(allowedOwners) ? { $in: allowedOwners } : allowedOwners;
      }

      const batch = await Batch.findOne(query);
      if (!batch) {
        return res.status(404).json({ success: false, error: "Không tìm thấy lớp học hoặc bạn không có quyền." });
      }

      const session = await QRAttendanceService.createSession(
        batchId,
        date,
        durationMinutes ? Number(durationMinutes) : 5,
        batch.ownerId
      );

      res.status(201).json({ success: true, ...session });
    } catch (error) {
      next(error);
    }
  }

  // 1.1 Lấy thông tin phiên công khai (PUBLIC - Rate-limited)
  static getSessionInfo(req: Request, res: Response) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp mã QR." });
      }

      const info = QRAttendanceService.getSessionInfo(String(token));
      res.json({ success: true, data: info });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể lấy thông tin phiên." });
    }
  }

  // 2. Lấy token hiện tại (GV/Admin)
  static async getToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "Thiếu sessionId." });
      }

      const tokenData = QRAttendanceService.getCurrentToken(sessionId);
      res.json({ success: true, ...tokenData });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể lấy token." });
    }
  }

  // 3. Lấy trạng thái checkin hiện tại (GV/Admin)
  static async getStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "Thiếu sessionId." });
      }

      const status = QRAttendanceService.getSessionStatus(sessionId);
      res.json({ success: true, ...status });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể lấy trạng thái." });
    }
  }

  // 4. Đóng phiên điểm danh sớm và lưu vào DB (GV/Admin)
  static async closeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: "Thiếu sessionId." });
      }

      await QRAttendanceService.closeSession(sessionId);
      res.json({ success: true, message: "Đã đóng phiên và lưu điểm danh thành công." });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể đóng phiên." });
    }
  }

  // 5. Học viên checkin (PUBLIC - Rate-limited)
  static async checkin(req: Request, res: Response) {
    try {
      const { token, phone, fingerprint } = req.body;
      if (!token || !phone) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp mã QR và số điện thoại." });
      }

      const result = await QRAttendanceService.checkin(token, phone, fingerprint || "");
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Điểm danh không thành công." });
    }
  }
}
