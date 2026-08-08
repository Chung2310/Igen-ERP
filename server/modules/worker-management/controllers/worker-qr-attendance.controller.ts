import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../middleware/auth";
import { WorkerQrAttendanceService, WorkerQrCheckinError } from "../services/worker-qr-attendance.service";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import {
  WORKER_DEVICE_COOKIE_NAME,
  WorkerDeviceService,
  workerDeviceClearCookieOptions,
  workerDeviceCookieOptions,
} from "../services/worker-device.service";
import { logger } from "../../../config/logger";

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

async function getRememberedWorker(info: { projectId: string }, device: Awaited<ReturnType<typeof WorkerDeviceService.resolve>>) {
  if (!device) return null;
  const project = await WorkerProjectModel.findOne({
    _id: info.projectId,
    companyCode: device.companyCode,
    deletedAt: null,
  }).select("workerIds").lean();
  if (!project?.workerIds?.some((workerId) => String(workerId) === device.workerId)) return null;

  const worker = await WorkerModel.findOne({
    _id: device.workerId,
    companyCode: device.companyCode,
    deletedAt: null,
  }).select("fullName").lean();
  return worker?.fullName ? { device, workerName: worker.fullName } : null;
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
      const rawCredential = req.cookies?.[WORKER_DEVICE_COOKIE_NAME];
      const resolvedDevice = await WorkerDeviceService.resolve(rawCredential);
      const remembered = await getRememberedWorker(data, resolvedDevice);
      if (remembered) {
        res.cookie(WORKER_DEVICE_COOKIE_NAME, rawCredential, workerDeviceCookieOptions(remembered.device.expiresAt));
      }
      res.json({
        success: true,
        data: {
          ...data,
          device: remembered
            ? { recognized: true, workerName: remembered.workerName }
            : { recognized: false },
        },
      });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async checkin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token, phone, fingerprint, latitude, longitude } = req.body;
      const sessionInfo = WorkerQrAttendanceService.getSessionInfo(token);
      const rawCredential = req.cookies?.[WORKER_DEVICE_COOKIE_NAME];
      const resolvedDevice = await WorkerDeviceService.resolve(rawCredential);
      const remembered = await getRememberedWorker(sessionInfo, resolvedDevice);
      if (!remembered && !phone) {
        return res.status(400).json({ success: false, reasonCode: "worker_not_found", error: "Vui lòng nhập số điện thoại đã đăng ký." });
      }
      const result = await WorkerQrAttendanceService.checkin(
        token,
        remembered ? undefined : phone,
        fingerprint || "",
        latitude == null ? undefined : Number(latitude),
        longitude == null ? undefined : Number(longitude),
        remembered?.device.workerId
      );
      const { workerId, companyCode, ...publicResult } = result;
      if (!remembered) {
        if (resolvedDevice) await WorkerDeviceService.revoke(rawCredential, "replaced_by_new_worker");
        try {
          const issued = await WorkerDeviceService.issue({
            companyCode,
            workerId,
            userAgent: req.get("user-agent") || "",
            fingerprint: fingerprint || "",
          });
          res.cookie(WORKER_DEVICE_COOKIE_NAME, issued.credential, workerDeviceCookieOptions(issued.expiresAt));
        } catch (error) {
          logger.error("[Worker-QR] Device credential could not be persisted", error);
        }
      } else {
        res.cookie(WORKER_DEVICE_COOKIE_NAME, rawCredential, workerDeviceCookieOptions(remembered.device.expiresAt));
      }
      res.json({ success: true, data: publicResult });
    } catch (error) {
      respondError(res, error, next);
    }
  }

  static async forgetDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await WorkerDeviceService.revoke(req.cookies?.[WORKER_DEVICE_COOKIE_NAME]);
      res.clearCookie(WORKER_DEVICE_COOKIE_NAME, workerDeviceClearCookieOptions);
      res.json({ success: true });
    } catch (error) {
      respondError(res, error, next);
    }
  }
}
