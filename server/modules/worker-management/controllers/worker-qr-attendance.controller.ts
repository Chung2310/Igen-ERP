import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../middleware/auth";
import { WorkerQrAttendanceService, WorkerQrCheckinError } from "../services/worker-qr-attendance.service";

function respondError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof WorkerQrCheckinError) {
    const status = error.reasonCode === "worker_not_found" || error.reasonCode === "session_invalid" ? 404 : 400;
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

export class WorkerQrAttendanceController {
  static async createSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyCode = getCompanyCode(req);
      const { projectId, date, durationMinutes } = req.body;
      const session = await WorkerQrAttendanceService.createSession(projectId, date, durationMinutes, companyCode);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async getCurrentToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const data = WorkerQrAttendanceService.getCurrentToken(sessionId);
      res.json({ success: true, data });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async getSessionStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const data = WorkerQrAttendanceService.getSessionStatus(sessionId);
      res.json({ success: true, data });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async closeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      await WorkerQrAttendanceService.closeSession(sessionId);
      res.json({ success: true, message: "Đã đóng phiên điểm danh." });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async getSessionInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.query;
      const data = WorkerQrAttendanceService.getSessionInfo(String(token));
      res.json({ success: true, data });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async checkin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token, phone, fingerprint, latitude, longitude } = req.body;
      const result = await WorkerQrAttendanceService.checkin(
        token,
        phone,
        fingerprint,
        latitude == null ? undefined : Number(latitude),
        longitude == null ? undefined : Number(longitude)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      respondError(res, error, next);
    }
  }
}
