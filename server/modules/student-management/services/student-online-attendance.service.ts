import crypto from "crypto";
import { Batch } from "../models/batch.model";
import { Student } from "../models/student.model";
import { StudentVerificationCodeModel } from "../models/student-verification-code.model";
import { StudentAttendanceAttemptModel } from "../models/student-attendance-attempt.model";
import { EmailService } from "./email.service";
import { AuthService } from "./auth.service";
import { verifyStudentAttendanceFace } from "./student-face-gate.service";
import { cloudinaryService } from "../../../service/cloudinary.service";
import { InsightFaceClient } from "../../../service/insightface.service";
import type { FaceReasonCode } from "../../../service/insightface.service";
import { companyEmailService } from "../../../service/company-email.service";
import { assertWithinSessionQuota, syncAttendedSessions } from "./batch.service";

const CODE_TTL_MS = 5 * 60 * 1000;

export type OnlineCheckinReasonCode =
  | "batch_not_found"
  | "student_not_found"
  | "code_invalid"
  | "code_expired"
  | "not_registered"
  | "missing_image"
  | FaceReasonCode;

export class OnlineCheckinError extends Error {
  constructor(public readonly reasonCode: OnlineCheckinReasonCode, message: string) {
    super(message);
    this.name = "OnlineCheckinError";
  }
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

const insightFaceClient = {
  verifyEmployee: (userId: string, image: Buffer, mimeType: string) =>
    new InsightFaceClient().verifyEmployee(userId, image, mimeType),
};

async function resolveSmtpSettings(actorUid: string) {
  const user = await AuthService.getUserProfile(actorUid);
  if (!user) return undefined;
  if (user.companyCode) {
    return companyEmailService.resolveLegacySettings(user.companyCode);
  }
  return undefined;
}

export class StudentOnlineAttendanceService {
  // GV/Admin chủ động sinh mã cho các học viên đã đăng ký khuôn mặt trong lớp
  static async createSessions(actorUid: string, ownerId: string, batchId: string, date: string) {
    const batch = await Batch.findOne({ _id: batchId, ownerId });
    if (!batch) {
      throw new OnlineCheckinError("batch_not_found", "Không tìm thấy lớp học hoặc bạn không có quyền.");
    }

    const students = await Student.find({ _id: { $in: batch.learnerIds }, ownerId });
    const smtpSettings = await resolveSmtpSettings(actorUid);

    const dateStr = date.trim();
    let sent = 0;
    let skippedNotRegistered = 0;
    let skippedNoEmail = 0;
    let failed = 0;

    for (const student of students) {
      if (!student.faceEnrollment?.registered) {
        skippedNotRegistered += 1;
        continue;
      }
      if (!student.email) {
        skippedNoEmail += 1;
        continue;
      }

      // Vô hiệu hoá mã cũ chưa dùng của học viên này trong lớp/ngày này
      await StudentVerificationCodeModel.deleteMany({
        studentId: student.id, ownerId, batchId, date: dateStr, used: false,
      });

      const code = generateCode();
      await StudentVerificationCodeModel.create({
        studentId: student.id,
        ownerId,
        batchId,
        date: dateStr,
        codeHash: hashCode(code),
        channel: "email",
        used: false,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
        createdAt: new Date(),
      });

      const result = await EmailService.sendMail({
        to: student.email,
        subject: `Mã điểm danh lớp ${batch.code} - ${dateStr}`,
        html: `<p>Xin chào ${student.fullName},</p>
<p>Mã điểm danh của bạn cho buổi học ngày <b>${dateStr}</b> (lớp <b>${batch.code}</b>) là:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
<p>Mã có hiệu lực trong 5 phút và chỉ dùng được một lần.</p>`,
      }, smtpSettings);

      if (result.success) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    return { sent, skippedNotRegistered, skippedNoEmail, failed, total: students.length };
  }

  // Học viên xác thực bằng mã + khuôn mặt (PUBLIC, rate-limited)
  static async checkin(
    phone: string,
    code: string,
    batchId: string,
    date: string,
    image: Buffer,
    mimeType: string
  ): Promise<{ success: boolean; studentName: string }> {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      throw new OnlineCheckinError("batch_not_found", "Không tìm thấy lớp học.");
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const student = await Student.findOne({ phone: cleanPhone, ownerId: batch.ownerId });
    if (!student) {
      throw new OnlineCheckinError("student_not_found", "Số điện thoại không có trong hệ thống hoặc không đúng cơ sở.");
    }

    const studentId = student._id.toString();
    const dateStr = date.trim();
    const attemptBase = {
      studentId,
      ownerId: batch.ownerId,
      batchId,
      channel: "online-code" as const,
    };

    const verificationRecord = await StudentVerificationCodeModel.findOne({
      studentId, ownerId: batch.ownerId, batchId, date: dateStr, used: false,
    }).sort({ createdAt: -1 });

    if (!verificationRecord || verificationRecord.expiresAt.getTime() < Date.now()) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "code_expired", attemptedAt: new Date(),
      });
      throw new OnlineCheckinError("code_expired", "Mã xác thực đã hết hạn. Vui lòng yêu cầu giáo viên gửi mã mới.");
    }

    if (verificationRecord.codeHash !== hashCode(code.trim())) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "code_invalid",
        verificationCodeId: verificationRecord.id, attemptedAt: new Date(),
      });
      throw new OnlineCheckinError("code_invalid", "Mã xác thực không đúng.");
    }

    // Mã đúng -> đánh dấu đã dùng ngay
    verificationRecord.used = true;
    verificationRecord.usedAt = new Date();
    await verificationRecord.save();

    if (!student.faceEnrollment?.registered || !student.faceEnrollment.insightFaceUserId) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "not_registered",
        verificationCodeId: verificationRecord.id, attemptedAt: new Date(),
      });
      throw new OnlineCheckinError("not_registered", "Học viên chưa đăng ký khuôn mặt. Vui lòng liên hệ giáo viên/admin.");
    }

    if (!image || image.length === 0) {
      await StudentAttendanceAttemptModel.create({
        ...attemptBase, outcome: "rejected", reasonCode: "missing_image",
        verificationCodeId: verificationRecord.id, attemptedAt: new Date(),
      });
      throw new OnlineCheckinError("missing_image", "Vui lòng chụp ảnh khuôn mặt để điểm danh.");
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
        verificationCodeId: verificationRecord.id,
        similarity: gateResult.verification.similarity ?? undefined,
        live: gateResult.verification.live ?? undefined,
        livenessScore: gateResult.verification.livenessScore ?? undefined,
        evidence: gateResult.evidence,
        evidenceDeleteAfter: gateResult.evidenceDeleteAfter,
        attemptedAt: new Date(),
      });
      throw new OnlineCheckinError(gateResult.reasonCode, "Xác thực khuôn mặt không thành công. Vui lòng thử lại.");
    }

    // Điểm danh online cũng tiêu một buổi học nên phải qua đúng hạn mức như
    // điểm danh thủ công.
    await assertWithinSessionQuota(batch, dateStr, [{ studentId, status: "present" }]);

    // Ghi nhận điểm danh vào phiên của ngày này (không ghi đè các học viên khác)
    let session = batch.attendanceSessions.find((s) => s.date === dateStr);
    if (!session) {
      batch.attendanceSessions.push({ date: dateStr, note: "Điểm danh online", records: [] } as any);
      session = batch.attendanceSessions.find((s) => s.date === dateStr);
    }
    if (session) {
      const existing = session.records.find((r) => r.studentId === studentId);
      let isLate = false;
      if (batch.startTime) {
        const startDateTime = new Date(`${dateStr}T${batch.startTime.padStart(5, "0")}:00`);
        if (!isNaN(startDateTime.getTime())) {
          isLate = Date.now() > startDateTime.getTime();
        }
      }
      const recordStatus = isLate ? "late" : "present";
      if (existing) {
        existing.status = recordStatus;
      } else {
        session.records.push({ studentId, status: recordStatus } as any);
      }
    }
    await batch.save();
    await syncAttendedSessions(batch);

    await StudentAttendanceAttemptModel.create({
      ...attemptBase,
      outcome: "accepted",
      reasonCode: gateResult.reasonCode,
      verificationCodeId: verificationRecord.id,
      similarity: gateResult.verification.similarity ?? undefined,
      live: gateResult.verification.live ?? undefined,
      livenessScore: gateResult.verification.livenessScore ?? undefined,
      evidence: gateResult.evidence,
      attemptedAt: new Date(),
    });

    return { success: true, studentName: student.fullName };
  }
}
