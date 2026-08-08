import { Request, Response, NextFunction } from "express";
import { QRAttendanceService, QrCheckinError } from "../services/qr-attendance.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import { Batch } from "../models/batch.model";
import { ModuleSettingsService } from "../services/module-settings.service";
import { WorkerQrAttendanceService } from "../../../modules/worker-management/services/worker-qr-attendance.service";
import { WorkerProjectModel } from "../../../modules/worker-management/models/worker-project.model";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  StudentDeviceService,
  STUDENT_DEVICE_COOKIE_NAME,
  studentDeviceClearCookieOptions,
  studentDeviceCookieOptions,
} from "../services/student-device.service";
import { Student } from "../models/student.model";
import { logger } from "../config/logger";

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

      const ownerId = String(req.user?.companyCode || "");
      const tenantId = await resolveCustomFieldTenantForOwner(ownerId);
      const { entityPreset } = await new ModuleSettingsService().get(tenantId);
      const isWorker = entityPreset === "worker";

      if (isWorker) {
        const project = await WorkerProjectModel.findOne({ _id: batchId, companyCode: ownerId, deletedAt: null });
        if (!project) return res.status(404).json({ success: false, error: "Không tìm thấy dự án hoặc bạn không có quyền." });
        const session = await WorkerQrAttendanceService.createSession(String(project._id), date, durationMinutes ? Number(durationMinutes) : WORKER_QR_DURATION_MINUTES, ownerId);
        return res.status(201).json({ success: true, sessionId: session.id, token: session.currentToken, expiresAt: session.expiresAt, date: session.date });
      }

      const allowedOwners = await getAllowedOwnerIds(req.user!);
      const query: Record<string, any> = { _id: batchId };
      if (allowedOwners !== "ALL") query.ownerId = Array.isArray(allowedOwners) ? { $in: allowedOwners } : allowedOwners;
      const batch = await Batch.findOne(query);
      if (!batch) return res.status(404).json({ success: false, error: "Không tìm thấy lớp học hoặc bạn không có quyền." });

      const studentTenantId = await resolveCustomFieldTenantForOwner(batch.ownerId);
      const studentSettings = await new ModuleSettingsService().get(studentTenantId);
      const studentPreset = studentSettings.entityPreset;
      if (studentPreset === "worker") return res.status(400).json({ success: false, error: "Không thể dùng lớp học để tạo phiên lao động." });      const session = await QRAttendanceService.createSession(batchId, date, durationMinutes ? Number(durationMinutes) : 5, batch.ownerId, { shared: false, mode: "class" });
      return res.status(201).json({ success: true, ...session });
    } catch (error) {
      next(error);
    }
  }

  // 1.1 Lấy thông tin phiên công khai (PUBLIC - Rate-limited)
  static async getSessionInfo(req: Request, res: Response) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp mã QR." });
      }

      let info;
      try {
        info = WorkerQrAttendanceService.getSessionInfo(String(token));
        return res.json({ success: true, data: info });
      } catch {
        info = QRAttendanceService.getSessionInfo(String(token));
      }

      let device: { recognized: boolean; studentName?: string } = { recognized: false };
      const rawCredential = req.cookies?.[STUDENT_DEVICE_COOKIE_NAME];
      const remembered = await StudentDeviceService.resolve(rawCredential);
      if (remembered) {
        const batch = await Batch.findOne({ _id: info.batchId, ownerId: remembered.ownerId }).select("learnerIds").lean();
        if (batch?.learnerIds.includes(remembered.studentId)) {
          const student = await Student.findOne({ _id: remembered.studentId, ownerId: remembered.ownerId }).select("fullName").lean();
          if (student?.fullName) {
            device = { recognized: true, studentName: student.fullName };
            // Renew the browser expiry at the same time as the server-side sliding expiry.
            res.cookie(STUDENT_DEVICE_COOKIE_NAME, rawCredential, studentDeviceCookieOptions(remembered.expiresAt));
          }
        }
      }
      res.json({ success: true, data: { ...info, device } });
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
      if (!token) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp mã QR." });
      }

      const lat = latitude !== undefined && latitude !== "" ? Number(latitude) : undefined;
      const lng = longitude !== undefined && longitude !== "" ? Number(longitude) : undefined;

      // Nhận diện khuôn mặt đã tạm ẩn, truyền buffer rỗng
      const fileBuffer = req.file?.buffer ?? Buffer.alloc(0);
      const fileMimeType = req.file?.mimetype ?? "image/jpeg";

      let workerSession = false;
      try {
        WorkerQrAttendanceService.getSessionInfo(token);
        workerSession = true;
      } catch {
        workerSession = false;
      }
      if (workerSession) {
        if (!phone) return res.status(400).json({ success: false, error: "Vui lòng cung cấp số điện thoại." });
        const workerResult = await WorkerQrAttendanceService.checkin(token, phone, fingerprint || "", lat, lng);
        return res.json({ success: true, workerName: workerResult.workerName, studentName: workerResult.workerName, distanceMeters: workerResult.distanceMeters, kind: workerResult.kind });
      }

      const sessionInfo = QRAttendanceService.getSessionInfo(token);
      const rawCredential = req.cookies?.[STUDENT_DEVICE_COOKIE_NAME];
      const resolvedDevice = await StudentDeviceService.resolve(rawCredential);
      const batch = await Batch.findById(sessionInfo.batchId).select("ownerId branchId learnerIds").lean();
      if (!batch) throw new QrCheckinError("batch_not_found", "Không tìm thấy lớp học.");
      const remembered = resolvedDevice
        && resolvedDevice.ownerId === batch.ownerId
        && batch.learnerIds.includes(resolvedDevice.studentId)
        ? resolvedDevice
        : null;
      if (!remembered && !phone) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập số điện thoại đã đăng ký." });
      }

      const result = await QRAttendanceService.checkin(
        token,
        phone,
        fingerprint || "",
        fileBuffer,
        fileMimeType,
        lat,
        lng,
        remembered?.studentId
      );

      if (!remembered) {
        if (resolvedDevice) await StudentDeviceService.revoke(rawCredential, "replaced_by_new_student");
        try {
          const issued = await StudentDeviceService.issue({
            ownerId: batch.ownerId,
            branchId: batch.branchId,
            studentId: result.studentId,
            batchId: sessionInfo.batchId,
            userAgent: req.get("user-agent") || "",
            fingerprint: fingerprint || "",
          });
          res.cookie(STUDENT_DEVICE_COOKIE_NAME, issued.credential, studentDeviceCookieOptions(issued.expiresAt));
        } catch (error) {
          // Attendance is already valid; a temporary credential-store failure must
          // not turn a successful check-in into an apparent failure/retry.
          logger.error("[QR-Attendance] Device credential could not be persisted", error);
        }
      } else {
        res.cookie(STUDENT_DEVICE_COOKIE_NAME, rawCredential, studentDeviceCookieOptions(remembered.expiresAt));
      }
      res.json(result);
    } catch (error: any) {
      if (error instanceof QrCheckinError) {
        return res.status(400).json({ success: false, error: error.message, reasonCode: error.reasonCode });
      }
      res.status(400).json({ success: false, error: error.message || "Điểm danh không thành công." });
    }
  }

  static async forgetDevice(req: Request, res: Response) {
    try {
      await StudentDeviceService.revoke(req.cookies?.[STUDENT_DEVICE_COOKIE_NAME]);
      res.clearCookie(STUDENT_DEVICE_COOKIE_NAME, studentDeviceClearCookieOptions);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || "Không thể quên thiết bị này." });
    }
  }
}
