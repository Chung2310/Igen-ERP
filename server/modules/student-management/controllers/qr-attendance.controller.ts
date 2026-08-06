import { Request, Response, NextFunction } from "express";
import { QRAttendanceService, QrCheckinError } from "../services/qr-attendance.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Batch } from "../models/batch.model";
import { ModuleSettingsService } from "../services/module-settings.service";
import { WorkerQrAttendanceService, WorkerQrCheckinError } from "../../../modules/worker-management/services/worker-qr-attendance.service";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";

/** QR chấm công lao động sống 1 giờ để quản lý kịp gửi vào nhóm chat. */
const WORKER_QR_DURATION_MINUTES = 60;

type UploadRequest = Request & { file?: Express.Multer.File };

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

      // Preset lấy từ cấu hình module của chính chủ sở hữu dự án, không tin
      // client: quyết định này đổi cả cách ghi dữ liệu lẫn tuổi thọ mã QR.
      const tenantId = await resolveCustomFieldTenantForOwner(batch.ownerId);
      const { entityPreset } = await new ModuleSettingsService().get(tenantId);
      const isWorker = entityPreset === "worker";

      if (isWorker) {
        const session = await WorkerQrAttendanceService.createSession(batchId, date, durationMinutes ? Number(durationMinutes) : WORKER_QR_DURATION_MINUTES, batch.ownerId);
        return res.status(201).json({ success: true, sessionId: session.id, token: session.currentToken, expiresAt: session.expiresAt, date: session.date });
      }

      const session = await QRAttendanceService.createSession(batchId, date, durationMinutes ? Number(durationMinutes) : 5, batch.ownerId, { shared: false, mode: "class" });
      return res.status(201).json({ success: true, ...session });
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

      let info; try { info = WorkerQrAttendanceService.getSessionInfo(String(token)); } catch { info = QRAttendanceService.getSessionInfo(String(token)); }
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

      let tokenData; try { tokenData = WorkerQrAttendanceService.getCurrentToken(sessionId); } catch { tokenData = QRAttendanceService.getCurrentToken(sessionId); }
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

      let status; try { status = WorkerQrAttendanceService.getSessionStatus(sessionId); } catch { status = QRAttendanceService.getSessionStatus(sessionId); }
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

      try { await WorkerQrAttendanceService.closeSession(sessionId); } catch { await QRAttendanceService.closeSession(sessionId); }
      res.json({ success: true, message: "Đã đóng phiên và lưu điểm danh thành công." });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể đóng phiên." });
    }
  }

  // 5. Học viên checkin (PUBLIC - Rate-limited) — multipart: ảnh khuôn mặt + GPS
  static async checkin(req: UploadRequest, res: Response) {
    try {
      const { token, phone, fingerprint, latitude, longitude } = req.body;
      if (!token || !phone) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp mã QR và số điện thoại." });
      }

      const lat = latitude !== undefined && latitude !== "" ? Number(latitude) : undefined;
      const lng = longitude !== undefined && longitude !== "" ? Number(longitude) : undefined;

      // Nhận diện khuôn mặt đã tạm ẩn, truyền buffer rỗng
      const fileBuffer = req.file?.buffer ?? Buffer.alloc(0);
      const fileMimeType = req.file?.mimetype ?? "image/jpeg";

      let result;
      try {
        WorkerQrAttendanceService.getSessionInfo(token);
        const workerResult = await WorkerQrAttendanceService.checkin(token, phone, fingerprint || "", lat, lng);
        result = { success: true, workerName: workerResult.workerName, studentName: workerResult.workerName, distanceMeters: workerResult.distanceMeters, kind: workerResult.kind };
      } catch (error) {
        if (error instanceof WorkerQrCheckinError) throw error;
        result = await QRAttendanceService.checkin(token, phone, fingerprint || "", fileBuffer, fileMimeType, lat, lng);
      }
      res.json(result);
    } catch (error: any) {
      if (error instanceof QrCheckinError) {
        return res.status(400).json({ success: false, error: error.message, reasonCode: error.reasonCode });
      }
      res.status(400).json({ success: false, error: error.message || "Điểm danh không thành công." });
    }
  }
}
