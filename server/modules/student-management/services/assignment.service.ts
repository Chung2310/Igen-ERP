import mongoose from "mongoose";
import { AssignmentModel } from "../models/assignment.model";
import { SubmissionModel } from "../models/submission.model";
import { Batch } from "../models/batch.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { EmailService, SmtpSettings } from "./email.service";
import jwt from "jsonwebtoken";
import { getJwtAccessSecret } from "../../../config/env";
import { emitToUser } from "../../../socket";
import { cloudinaryService } from "../../../service/cloudinary.service";
import { logger } from "../config/logger";
import { IAssignment } from "../interfaces/assignment.interface";
import { companyEmailService } from "../../../service/company-email.service";

type OwnerScope = string | string[];

function buildOwnerQuery(ownerId: OwnerScope): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

async function resolveSmtpForOwner(ownerId: string): Promise<SmtpSettings | undefined> {
  try {
    let owner: any = null;
    if (mongoose.Types.ObjectId.isValid(ownerId)) {
      owner = await User.findById(ownerId).select(
        "smtpHost smtpPort smtpSecure smtpUser smtpPass smtpFrom smtpSandboxEmail companyCode"
      );
    }
    if (!owner) {
      owner = await User.findOne({ $or: [{ companyCode: ownerId }, { uid: ownerId }] }).select(
        "smtpHost smtpPort smtpSecure smtpUser smtpPass smtpFrom smtpSandboxEmail companyCode"
      );
    }

    const companyCode = owner?.companyCode || (typeof ownerId === "string" ? ownerId : undefined);
    if (companyCode) {
      const companySettings = await companyEmailService.resolveLegacySettings(companyCode);
      if (companySettings) return companySettings;
    }

    if (owner?.smtpHost && owner?.smtpUser && owner?.smtpPass) {
      return {
        smtpHost: owner.smtpHost,
        smtpPort: owner.smtpPort,
        smtpSecure: owner.smtpSecure,
        smtpUser: owner.smtpUser,
        smtpPass: owner.smtpPass,
        smtpFrom: owner.smtpFrom,
        smtpSandboxEmail: owner.smtpSandboxEmail,
      };
    }

    if (companyCode) {
      const companyAdmin = await User.findOne({
        companyCode,
        smtpHost: { $exists: true, $ne: "" },
        smtpUser: { $exists: true, $ne: "" },
        smtpPass: { $exists: true, $ne: "" },
      }).select("smtpHost smtpPort smtpSecure smtpUser smtpPass smtpFrom smtpSandboxEmail");

      if (companyAdmin?.smtpHost && companyAdmin?.smtpUser && companyAdmin?.smtpPass) {
        return {
          smtpHost: companyAdmin.smtpHost,
          smtpPort: companyAdmin.smtpPort,
          smtpSecure: companyAdmin.smtpSecure,
          smtpUser: companyAdmin.smtpUser,
          smtpPass: companyAdmin.smtpPass,
          smtpFrom: companyAdmin.smtpFrom,
          smtpSandboxEmail: companyAdmin.smtpSandboxEmail,
        };
      }
    }
  } catch (err) {
    logger.error("Lỗi khi tìm cấu hình SMTP cho ownerId %s: %o", ownerId, err);
  }
  return undefined;
}

export class AssignmentService {
  static async createAssignment(
    data: any,
    instructorId: string,
    ownerId: string,
    ownerScope: OwnerScope = ownerId
  ): Promise<IAssignment> {
    const batch = await Batch.findOne({ _id: data.batchId, ...buildOwnerQuery(ownerScope) });
    if (!batch) throw new Error("Lớp học không tồn tại.");

    const assignmentOwnerId = String(batch.ownerId);
    const assignment = await AssignmentModel.create({
      ...data,
      courseId: batch.courseId,
      instructorId,
      ownerId: assignmentOwnerId,
      branchId: batch.branchId,
    });

    // Bắt đầu gửi email bất đồng bộ cho học viên trong lớp
    void this.notifyStudents(assignment, batch, assignmentOwnerId);

    return assignment;
  }

  static async getAssignments(ownerScope: OwnerScope, batchId: string): Promise<any[]> {
    return AssignmentModel.find({ batchId, ...buildOwnerQuery(ownerScope) }).sort({ createdAt: -1 });
  }

  static async getSubmissions(ownerScope: OwnerScope, assignmentId: string): Promise<any[]> {
    const assignment = await AssignmentModel.findOne({ _id: assignmentId, ...buildOwnerQuery(ownerScope) });
    if (!assignment) throw new Error("Assignment not found.");
    return SubmissionModel.find({ assignmentId });
  }

  static async notifyStudents(assignment: IAssignment, batch: any, ownerId: string): Promise<void> {
    try {
      const studentIds = batch.learnerIds || [];
      if (studentIds.length === 0) {
        logger.info(`[Assignment Email] Lớp ${batch.code} chưa có học viên nào để gửi email.`);
        return;
      }

      const students = await Student.find({ _id: { $in: studentIds } });
      const smtpSettings = await resolveSmtpForOwner(ownerId);
      const rawAppUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
      const appUrl = rawAppUrl.trim().replace(/\/+$/, "");

      let sentCount = 0;
      let failedCount = 0;

      for (const student of students) {
        if (!student.email) continue;

        // Cơ chế JWT riêng biệt cho từng email của học sinh
        const token = jwt.sign(
          {
            studentId: student._id.toString(),
            email: student.email,
            batchId: batch._id.toString(),
            assignmentId: assignment._id.toString(),
          },
          getJwtAccessSecret(),
          { expiresIn: "30d" }
        );

        const submissionUrl = `${appUrl}/public/submit-proof?token=${token}`;

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827;line-height:1.6;">
            <h2 style="color:#4f46e5;">Bài tập mới được giao: ${assignment.title}</h2>
            <p>Xin chào <strong>${student.fullName || "Học viên"}</strong>,</p>
            <p>Giảng viên của bạn vừa giao một bài tập mới cho lớp <strong>${batch.code}</strong>.</p>
            <div style="background:#f9fafb;border-left:4px solid #4f46e5;padding:12px;margin:16px 0;border-radius:4px;">
              <p style="margin:0 0 8px 0;"><strong>Yêu cầu/Mô tả:</strong></p>
              <p style="margin:0;color:#4b5563;">${assignment.description || "Không có mô tả chi tiết."}</p>
              ${assignment.dueDate ? `<p style="margin:8px 0 0 0;color:#ef4444;font-size:13px;"><strong>Hạn nộp:</strong> ${new Date(assignment.dueDate).toLocaleString("vi-VN")}</p>` : ""}
            </div>
            <p>Vui lòng nhấp vào liên kết dưới đây để thực hiện làm bài và tải lên minh chứng bài làm của bạn:</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${submissionUrl}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:bold;display:inline-block;">Nộp Minh Chứng Bài Làm</a>
            </div>
            <p style="color:#6b7280;font-size:12px;">Đường dẫn này được tạo riêng biệt cho địa chỉ email của bạn và không cần đăng nhập. Vui lòng không chia sẻ liên kết này.</p>
            <p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:12px;">Email được gửi tự động, vui lòng không trả lời.</p>
          </div>
        `;

        const result = await EmailService.sendMail(
          {
            to: student.email,
            subject: `[Bài tập] ${assignment.title} - Lớp ${batch.code}`,
            html,
          },
          smtpSettings
        );

        if (result.success) sentCount++;
        else failedCount++;
      }

      logger.info(`[Assignment Email] Đã gửi ${sentCount} email cho học viên lớp ${batch.code} (${failedCount} thất bại).`);
    } catch (error) {
      logger.error("Lỗi khi gửi email thông báo bài tập mới: %o", error);
    }
  }

  static async verifySubmissionToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, getJwtAccessSecret()) as any;
      if (!decoded.studentId || !decoded.assignmentId || !decoded.batchId) {
        throw new Error("Token không hợp lệ.");
      }
      return decoded;
    } catch (err) {
      throw new Error("Đường dẫn nộp bài đã hết hạn hoặc không hợp lệ.");
    }
  }

  private static async validateSubmissionContext(decodedToken: any): Promise<any> {
    const { studentId, assignmentId, batchId } = decodedToken;
    const assignment = await AssignmentModel.findOne({ _id: assignmentId, batchId });
    if (!assignment) throw new Error("Invalid submission link.");

    const [batch, student] = await Promise.all([
      Batch.findOne({ _id: batchId, ownerId: assignment.ownerId, learnerIds: studentId }),
      Student.findOne({ _id: studentId, ownerId: assignment.ownerId }),
    ]);
    if (!batch || !student) throw new Error("Invalid submission link.");
    return assignment;
  }

  static async getPublicContext(decodedToken: any): Promise<any> {
    const assignment = await this.validateSubmissionContext(decodedToken);
    const [student, submission] = await Promise.all([
      Student.findOne({ _id: decodedToken.studentId, ownerId: assignment.ownerId }),
      SubmissionModel.findOne({ assignmentId: decodedToken.assignmentId, studentId: decodedToken.studentId }),
    ]);
    return { assignment, student, submission };
  }

  static async uploadProofFile(decodedToken: any, fileBase64: string): Promise<string> {
    // Xác thực token gắn đúng học viên/lớp/bài tập trước khi cho upload minh chứng
    await this.validateSubmissionContext(decodedToken);
    return cloudinaryService.uploadMedia(fileBase64, "igen_erp/assignments/submissions");
  }

  static async submitProof(decodedToken: any, data: any): Promise<any> {
    const { studentId, assignmentId } = decodedToken;

    const assignment = await this.validateSubmissionContext(decodedToken);

    // Kiểm tra xem có nộp muộn không
    let status: "submitted" | "late" = "submitted";
    if (assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      status = "late";
    }

    // Upsert Submission
    const submission = await SubmissionModel.findOneAndUpdate(
      { assignmentId, studentId },
      {
        assignmentId,
        studentId,
        attachments: data.attachments,
        studentNotes: data.studentNotes,
        status,
        submittedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    // Phát Socket.IO thông báo cho giảng viên biết có học sinh nộp/cập nhật minh chứng
    emitToUser(assignment.instructorId, "submission_updated", {
      assignmentId,
      studentId,
      status,
      submittedAt: submission.submittedAt,
    });

    return submission;
  }

  static async cancelSubmission(decodedToken: any): Promise<void> {
    const { studentId, assignmentId } = decodedToken;

    const assignment = await this.validateSubmissionContext(decodedToken);

    // Delete Submission record to allow clean resubmission
    await SubmissionModel.deleteOne({ assignmentId, studentId });

    // Thông báo cho giảng viên qua Socket
    emitToUser(assignment.instructorId, "submission_updated", {
      assignmentId,
      studentId,
      status: "deleted",
      submittedAt: null,
    });
  }

  static async gradeSubmission(
    assignmentId: string,
    studentId: string,
    data: any,
    instructorId: string,
    ownerScope: OwnerScope = instructorId
  ): Promise<any> {
    const assignment = await AssignmentModel.findOne({ _id: assignmentId, ...buildOwnerQuery(ownerScope) });
    if (!assignment) throw new Error("Bài tập không tồn tại.");
    if (String(assignment.instructorId) !== instructorId) {
      throw new Error("Bạn không có quyền chấm điểm bài tập này.");
    }

    const submission = await SubmissionModel.findOneAndUpdate(
      { assignmentId, studentId },
      {
        score: data.score,
        feedback: data.feedback,
        status: "graded",
        gradedAt: new Date(),
      },
      { new: true }
    );

    if (!submission) throw new Error("Học viên chưa nộp bài tập này.");

    return submission;
  }
}
