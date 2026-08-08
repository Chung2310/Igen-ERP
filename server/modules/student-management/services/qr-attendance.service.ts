import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Batch } from "../models/batch.model";
import { Student } from "../models/student.model";
import { BatchService } from "./batch.service";
import { getJwtAccessSecret } from "../../../config/env";
import { emitToCompany } from "../../../socket";
import { logger } from "../config/logger";
import { calculateHaversineDistanceMeters } from "../utils/geo.util";
import { verifyStudentAttendanceFace } from "./student-face-gate.service";
import { StudentAttendanceAttemptModel } from "../models/student-attendance-attempt.model";
import { cloudinaryService } from "../../../service/cloudinary.service";
import { InsightFaceClient } from "../../../service/insightface.service";
import type { FaceReasonCode } from "../../../service/insightface.service";

import { Course } from "../models/course.model";

export type QrCheckinReasonCode =
  | "session_invalid"
  | "replay"
  | "device_conflict"
  | "student_not_found"
  | "not_in_batch"
  | "already_checked_in"
  | "missing_image"
  | "outside_radius"
  | "too_soon"
  | "already_completed"
  | "missing_location"
  | "batch_not_found"
  | FaceReasonCode;

export const QR_ATTENDANCE_ACCEPTED_REASON = 'verified';

export class QrCheckinError extends Error {
  constructor(public readonly reasonCode: QrCheckinReasonCode, message: string) {
    super(message);
    this.name = "QrCheckinError";
  }
}

export interface CheckedInStudent {
  studentId: string;
  phone: string;
  fullName: string;
  checkinAt: number;
}

export interface QRSession {
  id: string;
  batchId: string;
  batchCode: string;
  courseTitle: string;
  date: string;
  ownerId: string;
  durationMinutes: number;
  createdAt: number;
  expiresAt: number;
  currentToken: string;
  tokenExpiresAt: number;
  checkins: Map<string, CheckedInStudent>; // key = studentId
  deviceMap: Map<string, string>; // fingerprint -> phone
  closed: boolean;
  /**
   * QR dùng chung: ảnh mã được gửi vào nhóm chat cho nhiều người cùng quét, nên
   * token không xoay và nonce không bị tiêu sau lần quét đầu.
   */
  shared: boolean;
  /** "worker" ghi vào chấm công vào/ra; "class" giữ điểm danh theo buổi. */
  mode: "class" | "worker";
}

const sessions = new Map<string, QRSession>();

const insightFaceClient = {
  verifyEmployee: (userId: string, image: Buffer, mimeType: string) =>
    new InsightFaceClient().verifyEmployee(userId, image, mimeType),
};

// Helper generate JWT token mới với nonce ngẫu nhiên
function generateToken(
  sessionId: string,
  batchId: string,
  ttlSeconds = 30
): { token: string; expiresAt: number } {
  const nonce = crypto.randomUUID();
  const tokenExpiresAt = Date.now() + ttlSeconds * 1000;
  const token = jwt.sign(
    { sid: sessionId, bid: batchId, nonce },
    getJwtAccessSecret(),
    { expiresIn: ttlSeconds }
  );
  return { token, expiresAt: tokenExpiresAt };
}

export class QRAttendanceService {
  // 1. Tạo phiên mới
  static async createSession(
    batchId: string,
    date: string,
    durationMinutes: number = 5,
    ownerId: string,
    options: { shared?: boolean; mode?: "class" | "worker" } = {}
  ): Promise<{
    sessionId: string;
    token: string;
    expiresAt: number;
    tokenExpiresAt: number;
    shared: boolean;
    mode: "class" | "worker";
  }> {
    logger.info(`[QR-Attendance] Creating session for batchId=${batchId}, date=${date}, ownerId=${ownerId}`);
    
    // Tìm và đóng phiên cũ của lớp này trong ngày này nếu có
    for (const [id, session] of sessions.entries()) {
      if (session.batchId === batchId && session.date === date && !session.closed) {
        logger.info(`[QR-Attendance] Closing previous active session ${id} for batchId=${batchId}`);
        session.closed = true;
        sessions.delete(id);
      }
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }

    const course = await Course.findById(batch.courseId);
    const courseTitle = course ? course.title : "(Khóa học đã xóa)";

    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();
    const expiresAt = createdAt + durationMinutes * 60 * 1000;
    
    // QR token sống đúng bằng phiên: người dùng có thể chuyển từ trình quét tạm
    // sang Safari/Chrome mà không gặp mã hết hạn giữa chừng.
    const shared = options.shared === true;
    const mode = options.mode ?? "class";
    // Keep the QR token valid for the configured attendance session. This lets
    // a user move from an ephemeral scanner webview to Safari/Chrome without
    // losing the link after 30 seconds. The session expiry still invalidates it.
    const tokenTtlSeconds = Math.max(1, Math.ceil((expiresAt - createdAt) / 1000));
    const { token, expiresAt: tokenExpiresAt } = generateToken(sessionId, batchId, tokenTtlSeconds);

    const session: QRSession = {
      id: sessionId,
      batchId,
      batchCode: batch.code,
      courseTitle,
      date,
      ownerId,
      durationMinutes,
      createdAt,
      expiresAt,
      currentToken: token,
      tokenExpiresAt,
      checkins: new Map(),
      deviceMap: new Map(),
      closed: false,
      shared,
      mode
    };

    sessions.set(sessionId, session);
    return { sessionId, token, expiresAt, tokenExpiresAt, shared, mode };
  }

  // 1.1 Lấy thông tin lớp học công khai bằng token
  static getSessionInfo(token: string): {
    batchId: string;
    batchCode: string;
    courseTitle: string;
    date: string;
  } {
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtAccessSecret()) as any;
    } catch (err) {
      throw new Error("Mã QR không hợp lệ hoặc đã hết hạn.");
    }

    const { sid } = decoded;
    const session = sessions.get(sid);

    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new Error("Phiên điểm danh đã kết thúc hoặc không tồn tại.");
    }

    return {
      batchId: session.batchId,
      batchCode: session.batchCode,
      courseTitle: session.courseTitle,
      date: session.date
    };
  }

  // 2. Lấy token hiện tại. Token dùng chung vòng đời với phiên điểm danh;
  // không xoay trong thời gian phiên còn hiệu lực.
  static getCurrentToken(sessionId: string): {
    token: string;
    tokenExpiresAt: number;
    sessionExpiresAt: number;
  } {
    const session = sessions.get(sessionId);
    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new Error("Phiên điểm danh không tồn tại hoặc đã kết thúc.");
    }

    // Phiên dùng chung giữ nguyên token cho tới khi hết phiên
    return {
      token: session.currentToken,
      tokenExpiresAt: session.tokenExpiresAt,
      sessionExpiresAt: session.expiresAt
    };
  }

  // 3. Học viên checkin qua trang public (không cần auth) — xác thực khuôn mặt + GPS
  static async checkin(
    token: string,
    phone: string | undefined,
    fingerprint: string,
    image: Buffer,
    mimeType: string,
    latitude?: number,
    longitude?: number,
    rememberedStudentId?: string
  ): Promise<{
    success: boolean;
    studentId: string;
    studentName: string;
    distanceMeters?: number;
    kind?: "check-in" | "check-out";
  }> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtAccessSecret()) as any;
    } catch (err) {
      logger.warn(`[QR-Attendance] Invalid token checkin attempt.`);
      throw new QrCheckinError("session_invalid", "Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.");
    }

    const { sid } = decoded;
    const session = sessions.get(sid);

    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new QrCheckinError("session_invalid", "Phiên điểm danh đã kết thúc hoặc không tồn tại.");
    }

    // A QR is shared by the class during its short validity window. Duplicate
    // protection is per student/session below, never per token nonce.
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const student = rememberedStudentId
      ? await Student.findOne({ _id: rememberedStudentId, ownerId: session.ownerId })
      : await Student.findOne({ phone: cleanPhone, ownerId: session.ownerId });

    if (!student) {
      throw new QrCheckinError("student_not_found", "Số điện thoại không có trong hệ thống hoặc không đúng cơ sở.");
    }

    const studentId = student._id.toString();
    const resolvedPhone = String(student.phone || "").replace(/\D/g, "");
    if (fingerprint) {
      const registeredPhone = session.deviceMap.get(fingerprint);
      if (registeredPhone && registeredPhone !== resolvedPhone) {
        throw new QrCheckinError("device_conflict", "Thiết bị này đã được sử dụng để điểm danh cho học viên khác.");
      }
    }

    // D. Kiểm tra học viên có thuộc lớp này (batch) không
    const batch = await Batch.findById(session.batchId);
    if (!batch) {
      throw new QrCheckinError("session_invalid", "Không tìm thấy lớp học.");
    }

    if (!batch.learnerIds.includes(student._id.toString())) {
      throw new QrCheckinError("not_in_batch", "Học viên không nằm trong danh sách lớp học này.");
    }

    // E. Kiểm tra xem học viên đã điểm danh trong phiên này chưa. Phiên chấm
    // công lao động bỏ qua bước này vì lần quét thứ hai chính là giờ về.
    if (session.mode !== "worker" && session.checkins.has(studentId)) {
      throw new QrCheckinError("already_checked_in", "Bạn đã điểm danh thành công trước đó rồi.");
    }

    const attemptBase = {
      studentId,
      ownerId: session.ownerId,
      batchId: session.batchId,
      channel: "qr-offline" as const,
      sessionId: sid,
    };

    // F. Kiểm tra vị trí GPS nếu lớp học có cấu hình geoLocation
    let distanceMeters: number | undefined;
    if (batch.geoLocation?.latitude != null && batch.geoLocation?.longitude != null) {
      if (latitude == null || longitude == null) {
        await StudentAttendanceAttemptModel.create({
          ...attemptBase, outcome: "rejected", reasonCode: "missing_image",
          attemptedAt: new Date(),
        });
        throw new QrCheckinError("missing_image", "Không lấy được vị trí GPS của bạn. Vui lòng cấp quyền định vị và thử lại.");
      }
      distanceMeters = calculateHaversineDistanceMeters(
        latitude, longitude, batch.geoLocation.latitude, batch.geoLocation.longitude
      );
      const radius = batch.geoLocation.radiusMeters ?? 150;
      if (distanceMeters > radius) {
        await StudentAttendanceAttemptModel.create({
          ...attemptBase, outcome: "rejected", reasonCode: "outside_radius",
          latitude, longitude, distanceMeters, attemptedAt: new Date(),
        });
        throw new QrCheckinError(
          "outside_radius",
          `Bạn đang ở ngoài khu vực điểm danh cho phép (cách ${Math.round(distanceMeters)}m, giới hạn ${radius}m).`
        );
      }
    }

    // G. Xác thực khuôn mặt (Tạm thời bỏ qua theo yêu cầu để chỉ điểm danh vị trí)
    /*
    if (!student.faceEnrollment?.registered || !student.faceEnrollment.insightFaceUserId) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "not_registered",
        latitude, longitude, distanceMeters, attemptedAt: new Date(),
      });
      throw new QrCheckinError("not_registered", "Học viên chưa đăng ký khuôn mặt. Vui lòng liên hệ giáo viên/admin.");
    }

    if (!image || image.length === 0) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "missing_image",
        latitude, longitude, distanceMeters, attemptedAt: new Date(),
      });
      throw new QrCheckinError("missing_image", "Vui lòng chụp ảnh khuôn mặt để điểm danh.");
    }

    const gateResult = await verifyStudentAttendanceFace(
      { insightFaceUserId: student.faceEnrollment.insightFaceUserId, image, mimeType },
      { cloudinary: cloudinaryService, insightFace: insightFaceClient }
    );

    if (!gateResult.accepted) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase,
        outcome: "rejected",
        reasonCode: gateResult.reasonCode,
        similarity: gateResult.verification.similarity ?? undefined,
        live: gateResult.verification.live ?? undefined,
        livenessScore: gateResult.verification.livenessScore ?? undefined,
        latitude, longitude, distanceMeters,
        evidence: gateResult.evidence,
        evidenceDeleteAfter: gateResult.evidenceDeleteAfter,
        attemptedAt: new Date(),
      });
      throw new QrCheckinError(gateResult.reasonCode, "Xác thực khuôn mặt không thành công. Vui lòng thử lại.");
    }
    */

    // H. Ghi nhận checkin. Phiên lao động ghi vào bảng chấm công vào/ra (lần
    // quét đầu trong ngày là giờ vào, lần sau là giờ về) thay vì chỉ đánh dấu
    // có mặt như lớp học.
    let markKind: undefined;

    const checkinInfo: CheckedInStudent = {
      studentId,
      phone: resolvedPhone,
      fullName: student.fullName,
      checkinAt: Date.now()
    };

    session.checkins.set(studentId, checkinInfo);
    if (fingerprint) {
      session.deviceMap.set(fingerprint, resolvedPhone);
    }

    await StudentAttendanceAttemptModel.create({
      ...attemptBase,
      outcome: "accepted",
      reasonCode: QR_ATTENDANCE_ACCEPTED_REASON,
      latitude, longitude, distanceMeters,
      attemptedAt: new Date(),
    });

    logger.info(`[QR-Attendance] Student checked in successfully: name=${student.fullName}, session=${sid}`);

    // I. Emit event Socket.IO realtime cho tất cả thiết bị của cơ sở
    emitToCompany(session.ownerId, "qr-attendance:checkin", {
      sessionId: sid,
      studentId,
      fullName: student.fullName,
      phone: resolvedPhone,
      checkinAt: checkinInfo.checkinAt
    });

    return {
      success: true,
      studentId,
      studentName: student.fullName,
      distanceMeters,
      kind: markKind
    };
  }

  // 4. Lấy trạng thái điểm danh hiện tại của phiên
  static getSessionStatus(sessionId: string): {
    totalStudents: number;
    checkedIn: number;
    remaining: number;
    expiresAt: number;
    closed: boolean;
    students: Array<{
      studentId: string;
      fullName: string;
      phone: string;
      checkedIn: boolean;
      checkinAt?: number;
    }>;
  } {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Phiên điểm danh không tồn tại.");
    }

    const isExpired = Date.now() > session.expiresAt;
    const isClosed = session.closed || isExpired;

    // Lấy thông tin batch
    // Vì hàm này gọi đồng bộ để tiện polling nhanh, chúng ta chỉ map in-memory data
    // Các học viên trong lớp cần được lấy từ context
    // Để trả ra đầy đủ danh sách, ta trả ra session checkins, phía client sẽ so khớp với danh sách học viên
    // Hoặc nếu muốn backend map thì client cần truyền danh sách, hoặc service query.
    // Cách tối ưu nhất: trả ra array checkins, client tự so khớp vì client đã có sẵn list students của batch.
    // Tuy nhiên để chuẩn API, chúng ta sẽ lấy thông tin checkins dạng array.
    const checkinsArray = Array.from(session.checkins.values()).map(c => ({
      studentId: c.studentId,
      fullName: c.fullName,
      phone: c.phone,
      checkedIn: true,
      checkinAt: c.checkinAt
    }));

    return {
      totalStudents: 0, // Client tự so khớp
      checkedIn: checkinsArray.length,
      remaining: 0,
      expiresAt: session.expiresAt,
      closed: isClosed,
      students: checkinsArray
    };
  }

  // 5. Đóng phiên và lưu dữ liệu vào DB thông qua BatchService
  static async closeSession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error("Phiên điểm danh không tồn tại.");
    }

    if (session.closed) {
      logger.info(`[QR-Attendance] Session ${sessionId} already closed.`);
      return;
    }

    session.closed = true;


    // Tìm lớp học để lấy toàn bộ học viên
    const batch = await Batch.findById(session.batchId);
    if (!batch) {
      sessions.delete(sessionId);
      throw new Error("Không tìm thấy lớp học để lưu điểm danh.");
    }

    // Build danh sách điểm danh
    // Học viên nào checkin trong session -> present hoặc late, còn lại -> absent
    const records = batch.learnerIds.map(studentId => {
      const checkedIn = session.checkins.has(studentId);
      let isLate = false;
      if (checkedIn && batch.startTime) {
        const checkinTime = session.checkins.get(studentId)?.checkinAt;
        const startDateTime = new Date(`${session.date}T${batch.startTime.padStart(5, "0")}:00`);
        if (checkinTime && !isNaN(startDateTime.getTime())) {
          isLate = checkinTime > startDateTime.getTime();
        }
      }
      return {
        studentId,
        status: (checkedIn ? (isLate ? "late" : "present") : "absent") as "present" | "absent" | "excused" | "late"
      };
    });

    // Lưu điểm danh vào DB
    await BatchService.saveAttendanceSession(
      session.ownerId,
      session.batchId,
      session.date,
      records,
      `Điểm danh tự động qua QR Code (${session.checkins.size}/${batch.learnerIds.length} học viên có mặt)`
    );

    // Xóa session khỏi bộ nhớ
    sessions.delete(sessionId);
    logger.info(`[QR-Attendance] Saved & Closed session ${sessionId} for batchId=${session.batchId}`);
  }
}

// Auto-cleanup các session hết hạn quá 1 phút định kỳ mỗi phút
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt + 60 * 1000) {
      logger.info(`[QR-Attendance] Auto-cleaned expired session=${id}`);
      sessions.delete(id);
    }
  }
}, 60 * 1000);


