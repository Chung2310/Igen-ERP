import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Batch } from "../models/batch.model";
import { Student } from "../models/student.model";
import { BatchService } from "./batch.service";
import { getJwtAccessSecret } from "../../../config/env";
import { emitToCompany } from "../../../socket";
import { logger } from "../config/logger";

import { Course } from "../models/course.model";

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
  usedNonces: Set<string>;
  deviceMap: Map<string, string>; // fingerprint -> phone
  closed: boolean;
}

const sessions = new Map<string, QRSession>();

// Helper generate JWT token mới với nonce ngẫu nhiên
function generateToken(sessionId: string, batchId: string): { token: string; expiresAt: number } {
  const nonce = crypto.randomUUID();
  const tokenExpiresAt = Date.now() + 30 * 1000; // 30s TTL
  const token = jwt.sign(
    { sid: sessionId, bid: batchId, nonce },
    getJwtAccessSecret(),
    { expiresIn: "30s" }
  );
  return { token, expiresAt: tokenExpiresAt };
}

export class QRAttendanceService {
  // 1. Tạo phiên mới
  static async createSession(
    batchId: string,
    date: string,
    durationMinutes: number = 5,
    ownerId: string
  ): Promise<{ sessionId: string; token: string; expiresAt: number; tokenExpiresAt: number }> {
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
    
    const { token, expiresAt: tokenExpiresAt } = generateToken(sessionId, batchId);

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
      usedNonces: new Set(),
      deviceMap: new Map(),
      closed: false
    };

    sessions.set(sessionId, session);
    return { sessionId, token, expiresAt, tokenExpiresAt };
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

  // 2. Lấy token hiện tại, nếu hết hạn 30s thì tự xoay token mới
  static getCurrentToken(sessionId: string): {
    token: string;
    tokenExpiresAt: number;
    sessionExpiresAt: number;
  } {
    const session = sessions.get(sessionId);
    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new Error("Phiên điểm danh không tồn tại hoặc đã kết thúc.");
    }

    // Nếu token hiện tại đã hết hạn (hoặc gần hết hạn, buffer 1s)
    if (Date.now() >= session.tokenExpiresAt - 1000) {
      const { token, expiresAt } = generateToken(sessionId, session.batchId);
      session.currentToken = token;
      session.tokenExpiresAt = expiresAt;
      logger.info(`[QR-Attendance] Rotated token for session=${sessionId}`);
    }

    return {
      token: session.currentToken,
      tokenExpiresAt: session.tokenExpiresAt,
      sessionExpiresAt: session.expiresAt
    };
  }

  // 3. Học viên checkin qua trang public (không cần auth)
  static async checkin(
    token: string,
    phone: string,
    fingerprint: string
  ): Promise<{ success: boolean; studentName: string }> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtAccessSecret()) as any;
    } catch (err) {
      logger.warn(`[QR-Attendance] Invalid token checkin attempt.`);
      throw new Error("Mã QR không hợp lệ hoặc đã hết hạn. Vui lòng quét lại.");
    }

    const { sid, bid, nonce } = decoded;
    const session = sessions.get(sid);

    if (!session || session.closed || Date.now() > session.expiresAt) {
      throw new Error("Phiên điểm danh đã kết thúc hoặc không tồn tại.");
    }

    // A. Chống replay bằng nonce
    if (session.usedNonces.has(nonce)) {
      throw new Error("Mã QR này đã được quét và sử dụng rồi.");
    }
    session.usedNonces.add(nonce);

    // B. Chống gian lận bằng fingerprint: 1 thiết bị chỉ điểm danh cho 1 SĐT
    const cleanPhone = phone.replace(/\D/g, "");
    if (fingerprint) {
      const registeredPhone = session.deviceMap.get(fingerprint);
      if (registeredPhone && registeredPhone !== cleanPhone) {
        throw new Error("Thiết bị này đã được sử dụng để điểm danh cho học viên khác.");
      }
    }

    // C. Tìm học viên trong DB theo phone và ownerId của batch
    const student = await Student.findOne({
      phone: cleanPhone,
      ownerId: session.ownerId
    });

    if (!student) {
      throw new Error("Số điện thoại không có trong hệ thống hoặc không đúng cơ sở.");
    }

    // D. Kiểm tra học viên có thuộc lớp này (batch) không
    const batch = await Batch.findById(session.batchId);
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }

    if (!batch.learnerIds.includes(student._id.toString())) {
      throw new Error("Học viên không nằm trong danh sách lớp học này.");
    }

    // E. Kiểm tra xem học viên đã điểm danh trong phiên này chưa
    if (session.checkins.has(student._id.toString())) {
      throw new Error("Bạn đã điểm danh thành công trước đó rồi.");
    }

    // F. Ghi nhận checkin
    const checkinInfo: CheckedInStudent = {
      studentId: student._id.toString(),
      phone: cleanPhone,
      fullName: student.fullName,
      checkinAt: Date.now()
    };

    session.checkins.set(student._id.toString(), checkinInfo);
    if (fingerprint) {
      session.deviceMap.set(fingerprint, cleanPhone);
    }

    logger.info(`[QR-Attendance] Student checked in successfully: name=${student.fullName}, session=${sid}`);

    // G. Emit event Socket.IO realtime cho tất cả thiết bị của cơ sở
    emitToCompany(session.ownerId, "qr-attendance:checkin", {
      sessionId: sid,
      studentId: student._id.toString(),
      fullName: student.fullName,
      phone: cleanPhone,
      checkinAt: checkinInfo.checkinAt
    });

    return {
      success: true,
      studentName: student.fullName
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
    // Học viên nào checkin trong session -> present, còn lại -> absent
    const records = batch.learnerIds.map(studentId => {
      const checkedIn = session.checkins.has(studentId);
      return {
        studentId,
        status: (checkedIn ? "present" : "absent") as "present" | "absent" | "excused"
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
