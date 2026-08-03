import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import {
  WorkerAttendanceService,
  WorkerAttendanceError,
  vietnamWorkDate,
} from "../services/worker-attendance.service";

function respondError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof WorkerAttendanceError) {
    const status = error.reasonCode === "batch_not_found" || error.reasonCode === "log_not_found" ? 404 : 400;
    return res.status(status).json({ success: false, reasonCode: error.reasonCode, error: error.message });
  }
  return next(error);
}

export class WorkerAttendanceController {
  /** Bấm chấm công: lần đầu trong ngày là giờ vào, lần sau là giờ về. */
  static async mark(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { batchId, studentId, latitude, longitude, deviceInfo } = req.body;
      if (!batchId || !studentId) {
        return res.status(400).json({ success: false, error: "Thiếu dự án hoặc lao động cần chấm công." });
      }

      const result = await WorkerAttendanceService.mark({
        batchId: String(batchId),
        studentId: String(studentId),
        ownerId: await getAllowedOwnerIds(req.user!),
        branchId: req.user?.branchId,
        latitude: latitude == null ? undefined : Number(latitude),
        longitude: longitude == null ? undefined : Number(longitude),
        deviceInfo: deviceInfo ? String(deviceInfo) : "",
        ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "",
        recordedBy: req.user?.uid,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return respondError(res, error, next);
    }
  }

  /** Bảng chấm công của dự án: một ngày (mặc định hôm nay) hoặc khoảng ngày. */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const batchId = String(req.query.batchId || "");
      if (!batchId) return res.status(400).json({ success: false, error: "Thiếu dự án." });

      const ownerId = await getAllowedOwnerIds(req.user!);
      const from = req.query.from ? String(req.query.from) : "";
      const to = req.query.to ? String(req.query.to) : "";

      const data = from && to
        ? await WorkerAttendanceService.listByBatchRange(ownerId, batchId, from, to)
        : await WorkerAttendanceService.listByBatchDate(
            ownerId,
            batchId,
            req.query.date ? String(req.query.date) : vietnamWorkDate()
          );

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return respondError(res, error, next);
    }
  }

  /** Quản lý sửa tay: bù giờ về bị quên hoặc chỉnh mốc giờ sai. */
  static async adjust(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await WorkerAttendanceService.adjust(
        await getAllowedOwnerIds(req.user!),
        String(req.params.id),
        {
          checkInAt: req.body.checkInAt,
          checkOutAt: req.body.checkOutAt,
          note: req.body.note,
        },
        req.user?.uid || ""
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return respondError(res, error, next);
    }
  }
}
