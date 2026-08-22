import crypto from "crypto";
import jwt from "jsonwebtoken";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import { WorkerAttendanceService, WorkerAttendanceError } from "./worker-attendance.service";
import { getJwtAccessSecret } from "../../../config/env";
import { emitToCompany } from "../../../socket";
import { logger } from "../../../config/logger";

export type WorkerQrReasonCode =
  | "session_invalid"
  | "device_conflict"
  | "worker_not_found"
  | "not_in_project"
  | "project_not_found"
  | "missing_location"
  | "outside_radius"
  | "too_soon"
  | "already_completed";

export class WorkerQrCheckinError extends Error {
  constructor(public readonly reasonCode: WorkerQrReasonCode, message: string) {
    super(message);
    this.name = "WorkerQrCheckinError";
  }
}

export interface WorkerQRSession {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  date: string;
  companyCode: string;
  durationMinutes: number;
  createdAt: number;
  expiresAt: number;
  currentToken: string;
  tokenExpiresAt: number;
  checkins: Map<string, { workerId: string; phone: string; fullName: string; checkinAt: number }>;
  deviceMap: Map<string, string>;
  closed: boolean;
}

const sessions = new Map<string, WorkerQRSession>();

function generateToken(sessionId: string, projectId: string, ttlSeconds = 30): { token: string; expiresAt: number } {
  const nonce = crypto.randomUUID();
  const tokenExpiresAt = Date.now() + ttlSeconds * 1000;
  const token = jwt.sign(
    { sid: sessionId, bid: projectId, nonce },
    getJwtAccessSecret(),
    { expiresIn: ttlSeconds }
  );
  return { token, expiresAt: tokenExpiresAt };
}

export const WorkerQrAttendanceService = {
  async createSession(
    projectId: string,
    date: string,
    durationMinutes: number = 60,
    companyCode: string
  ): Promise<WorkerQRSession> {
    logger.info(`[Worker-QR] Creating session for projectId=${projectId}, date=${date}, companyCode=${companyCode}`);

    // Close any previous sessions for this project on this date
    for (const [id, session] of sessions.entries()) {
      if (session.projectId === projectId && session.date === date && !session.closed) {
        session.closed = true;
        sessions.delete(id);
      }
    }

    // Phải giới hạn theo công ty, nếu không quản lý công ty này có thể mở phiên
    // điểm danh trên dự án của công ty khác và lộ mã/tên dự án đó.
    const project = await WorkerProjectModel.findOne({ _id: projectId, companyCode, deletedAt: null });
    if (!project) {
      throw new WorkerQrCheckinError("project_not_found", "Không tìm thấy dự án trong công ty của bạn.");
    }

    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();
    const expiresAt = createdAt + durationMinutes * 60 * 1000;

    // Worker sessions are shared by default - token TTL equals session TTL
    const tokenTtlSeconds = Math.ceil((expiresAt - createdAt) / 1000);
    const { token, expiresAt: tokenExpiresAt } = generateToken(sessionId, projectId, tokenTtlSeconds);

    const session: WorkerQRSession = {
      id: sessionId,
      projectId,
      projectCode: project.code,
      projectName: project.name,
      date,
      companyCode,
      durationMinutes,
      createdAt,
      expiresAt,
      currentToken: token,
      tokenExpiresAt,
      checkins: new Map(),
      deviceMap: new Map(),
      closed: false,
    };

    sessions.set(sessionId, session);
    return session;
  },

  getCurrentToken(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new Error("Phiên điểm danh không tồn tại hoặc đã kết thúc.");
    }
    return {
      token: session.currentToken,
      tokenExpiresAt: session.tokenExpiresAt,
      sessionExpiresAt: session.expiresAt,
    };
  },

  getSessionInfo(token: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtAccessSecret()) as any;
    } catch {
      throw new WorkerQrCheckinError("session_invalid", "Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.");
    }
    const { sid } = decoded;
    const session = sessions.get(sid);
    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new WorkerQrCheckinError("session_invalid", "Phiên điểm danh đã kết thúc hoặc không tồn tại.");
    }
    return {
      projectId: session.projectId,
      projectCode: session.projectCode,
      projectName: session.projectName,
      date: session.date,
    };
  },

  async checkin(
    token: string,
    phone: string | undefined,
    fingerprint: string,
    latitude?: number,
    longitude?: number,
    rememberedWorkerId?: string
  ): Promise<{
    success: boolean;
    workerId: string;
    companyCode: string;
    workerName: string;
    distanceMeters?: number;
    kind: "check-in" | "check-out";
  }> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtAccessSecret()) as any;
    } catch {
      throw new WorkerQrCheckinError("session_invalid", "Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.");
    }

    const { sid } = decoded;
    const session = sessions.get(sid);
    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new WorkerQrCheckinError("session_invalid", "Phiên điểm danh đã kết thúc hoặc không tồn tại.");
    }

    const cleanPhone = (phone || "").replace(/\D/g, "");
    // Không có SĐT lẫn thiết bị đã ghi nhớ thì phải dừng: truy vấn phone rỗng sẽ
    // khớp nhầm bất kỳ hồ sơ nào chưa có số điện thoại.
    if (!rememberedWorkerId && !cleanPhone) {
      throw new WorkerQrCheckinError("worker_not_found", "Vui lòng nhập số điện thoại đã đăng ký.");
    }
    if (fingerprint && cleanPhone) {
      const registeredPhone = session.deviceMap.get(fingerprint);
      if (registeredPhone && registeredPhone !== cleanPhone) {
        throw new WorkerQrCheckinError("device_conflict", "Thiết bị này đã được dùng để chấm công cho lao động khác.");
      }
    }

    const worker = await WorkerModel.findOne(
      rememberedWorkerId
        ? { _id: rememberedWorkerId, companyCode: session.companyCode, deletedAt: null }
        : { phone: cleanPhone, companyCode: session.companyCode, deletedAt: null }
    );
    if (!worker) {
      throw new WorkerQrCheckinError("worker_not_found", "Số điện thoại không có trong hệ thống hoặc không đúng cơ sở.");
    }

    const workerPhone = String(worker.phone || cleanPhone).replace(/\D/g, "");
    if (fingerprint) {
      const registeredPhone = session.deviceMap.get(fingerprint);
      if (registeredPhone && registeredPhone !== workerPhone) {
        throw new WorkerQrCheckinError("device_conflict", "Thiết bị này đã được dùng để chấm công cho lao động khác.");
      }
    }

    const project = await WorkerProjectModel.findById(session.projectId);
    if (!project) {
      throw new WorkerQrCheckinError("session_invalid", "Không tìm thấy dự án.");
    }

    const workerIdStr = worker._id!.toString();
    if (!project.workerIds.some((id) => id.toString() === workerIdStr)) {
      throw new WorkerQrCheckinError("not_in_project", "Lao động không thuộc danh sách dự án này.");
    }

    // Kiểm tra bán kính do WorkerAttendanceService.mark đảm nhiệm — trước đây chỗ
    // này kiểm lại với bán kính mặc định 150m trong khi mark dùng 300m, nên lao
    // động ở khoảng giữa bị từ chối dù dự án cho phép.
    let markResult;
    try {
      markResult = await WorkerAttendanceService.mark({
        workerId: workerIdStr,
        projectId: session.projectId,
        companyCode: session.companyCode,
        latitude,
        longitude,
        deviceInfo: fingerprint,
      });
    } catch (error) {
      if (error instanceof WorkerAttendanceError) {
        throw new WorkerQrCheckinError(error.reasonCode as WorkerQrReasonCode, error.message);
      }
      throw error;
    }

    session.checkins.set(workerIdStr, {
      workerId: workerIdStr,
      phone: workerPhone,
      fullName: worker.fullName,
      checkinAt: Date.now(),
    });
    if (fingerprint) {
      session.deviceMap.set(fingerprint, workerPhone);
    }

    emitToCompany(session.companyCode, "worker-qr-attendance:checkin", {
      sessionId: sid,
      workerId: workerIdStr,
      fullName: worker.fullName,
      phone: workerPhone,
      checkinAt: Date.now(),
      kind: markResult.kind,
    });

    return {
      success: true,
      workerId: workerIdStr,
      companyCode: session.companyCode,
      workerName: worker.fullName,
      distanceMeters: markResult.distanceMeters,
      kind: markResult.kind,
    };
  },

  getSessionStatus(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Phiên điểm danh không tồn tại.");
    }
    const isClosed = session.closed || Date.now() > session.expiresAt;
    const checkinsArray = Array.from(session.checkins.values()).map((c) => ({
      workerId: c.workerId,
      fullName: c.fullName,
      phone: c.phone,
      checkedIn: true,
      checkinAt: c.checkinAt,
    }));

    return {
      checkedIn: checkinsArray.length,
      expiresAt: session.expiresAt,
      closed: isClosed,
      workers: checkinsArray,
    };
  },

  async closeSession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Phiên điểm danh không tồn tại.");
    }
    session.closed = true;
    sessions.delete(sessionId);
    logger.info(`[Worker-QR] Closed session ${sessionId} for projectId=${session.projectId}`);
  },
};

// Cleanup expired sessions hourly
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt + 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 60 * 1000);
