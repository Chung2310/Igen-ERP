import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../middleware/auth";
import {
  WorkerAttendanceService,
  WorkerAttendanceError,
  vietnamWorkDate,
} from "../services/worker-attendance.service";

function respondError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof WorkerAttendanceError) {
    const status = error.reasonCode === "project_not_found" || error.reasonCode === "log_not_found" ? 404 : 400;
    return res.status(status).json({ success: false, reasonCode: error.reasonCode, error: error.message });
  }
  return next(error);
}

function getCompanyCode(req: AuthenticatedRequest) {
  const companyCode = req.user?.companyCode;
  if (!companyCode) {
    throw new Error("Không xác định được mã công ty của tài khoản.");
  }
  return companyCode;
}

export class WorkerAttendanceController {
  /** Bấm chấm công: lần đầu trong ngày là giờ vào, lần sau là giờ về. */
  static async mark(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { projectId, workerId, latitude, longitude, deviceInfo } = req.body;
      if (!projectId || !workerId) {
        return res.status(400).json({ success: false, error: "Thiếu dự án hoặc lao động cần chấm công." });
      }

      const result = await WorkerAttendanceService.mark({
        projectId: String(projectId),
        workerId: String(workerId),
        companyCode: getCompanyCode(req),
        branchId: req.user?.branchId,
        latitude: latitude == null ? undefined : Number(latitude),
        longitude: longitude == null ? undefined : Number(longitude),
        deviceInfo: deviceInfo ? String(deviceInfo) : "",
        ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "",
        recordedBy: req.user?.id,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return respondError(res, error, next);
    }
  }

  /** Bảng chấm công của dự án: một ngày (mặc định hôm nay) hoặc khoảng ngày. */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projectId = String(req.query.projectId || "");
      if (!projectId) return res.status(400).json({ success: false, error: "Thiếu dự án." });

      const companyCode = getCompanyCode(req);
      const from = req.query.from ? String(req.query.from) : "";
      const to = req.query.to ? String(req.query.to) : "";

      const data = from && to
        ? await WorkerAttendanceService.listByProjectRange(companyCode, projectId, from, to)
        : await WorkerAttendanceService.listByProjectDate(
            companyCode,
            projectId,
            req.query.date ? String(req.query.date) : vietnamWorkDate()
          );

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return respondError(res, error, next);
    }
  }

  /** Quản lý sửa tay: bù giờ về bị quên hoặc chỉnh mốc giờ sai. */
  static async adjust(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await WorkerAttendanceService.adjust(
        getCompanyCode(req),
        String(req.params.id),
        {
          checkInAt: req.body.checkInAt,
          checkOutAt: req.body.checkOutAt,
          note: req.body.note,
        },
        req.user?.id || ""
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return respondError(res, error, next);
    }
  }
}
