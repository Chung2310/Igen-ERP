import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { PaymentService } from "./payment.service";
import { sseManager } from "./sse.manager";
import { logger } from "../config/logger";

export class WebhookService {
  /**
   * Khớp học viên từ nội dung chuyển khoản (description) của một admin (ownerId).
   * Ưu tiên 1: Tìm theo ObjectID 24 ký tự hex của học viên trong nội dung.
   * Ưu tiên 2: Trích xuất SĐT (9-11 chữ số) và khớp SĐT học viên.
   */
  static async matchStudentByDescription(description: string, ownerId: string, branchId?: string) {
    logger.info(`[Webhook] Matching student for ownerId: ${ownerId}, description: "${description}"`);

    // Fetch the admin user
    const adminUser = await User.findById(ownerId);
    if (!adminUser) return null;

    // Get all users in the same ERP company scope (including the admin themselves)
    const companyCode = adminUser.companyCode;
    const companyUsers = companyCode ? await User.find({ companyCode }).select("_id") : [];
    const allowedOwnerIds = [...new Set([ownerId, ...companyUsers.map(u => u._id.toString())])];
    const branchScope = branchId ? { branchId } : {};
    logger.info(`[Webhook] adminUser companyCode: ${companyCode}, allowedOwnerIds: ${JSON.stringify(allowedOwnerIds)}`);

    // 1. Tìm ObjectID 24 ký tự hex
    const objectIdRegex = /[0-9a-fA-F]{24}/;
    const objectIdMatch = description.match(objectIdRegex);
    if (objectIdMatch) {
      const studentId = objectIdMatch[0];
      const student = await Student.findOne({
        _id: studentId,
        ownerId: { $in: allowedOwnerIds },
        ...branchScope,
      });
      if (student) {
        logger.info(`[Webhook] Matched student by ID: ${student.fullName} (${student._id})`);
        return student;
      }
      const studentAnyOwner = branchId
        ? null
        : await Student.findById(studentId).select("fullName ownerId");
      if (studentAnyOwner) {
        logger.warn(`[Webhook] Found studentId ${studentId} (${studentAnyOwner.fullName}) but its ownerId "${studentAnyOwner.ownerId}" is outside allowedOwnerIds for this center.`);
      } else {
        logger.warn(`[Webhook] Extracted studentId ${studentId} from description but no student exists with this ID at all.`);
      }
    }

    // 2. Tìm SĐT (chuỗi 9-11 số liên tiếp)
    const digitsRegex = /\d{9,11}/g;
    const digitMatches = description.match(digitsRegex);
    if (digitMatches) {
      const students = await Student.find({
        ownerId: { $in: allowedOwnerIds },
        ...branchScope,
      });
      
      for (const num of digitMatches) {
        let cleanTarget = num;
        if (cleanTarget.startsWith("84")) {
          cleanTarget = "0" + cleanTarget.substring(2);
        }
        
        for (const student of students) {
          const dbPhoneClean = student.phone.replace(/\D/g, "");
          const targetPhoneClean = cleanTarget.replace(/\D/g, "");
          
          if (
            dbPhoneClean === targetPhoneClean ||
            dbPhoneClean.endsWith(targetPhoneClean) ||
            targetPhoneClean.endsWith(dbPhoneClean)
          ) {
            logger.info(`[Webhook] Matched student by Phone: ${student.fullName} (${student._id}) via SĐT match: ${num}`);
            return student;
          }
        }
      }
    }

    logger.warn(`[Webhook] No student matched for description: "${description}"`);
    return null;
  }

  /**
   * Xử lý giao dịch nhận tiền từ webhook ngân hàng (Casso/SePay).
   */
  static async processIncomingTransaction(payload: {
    description?: string;
    content?: string;
    amount?: number;
    transferAmount?: number;
    when?: string;
    transactionDate?: string;
    subAccount?: string | number;
    accountNumber?: string | number;
    [key: string]: unknown;
  }) {
    logger.info(`[Webhook] Processing incoming transaction payload: ${JSON.stringify(payload)}`);

    // Parse thông tin linh hoạt từ Casso hoặc SePay
    const description = payload.description || payload.content || "";
    const amount = Number(payload.amount || payload.transferAmount || 0);
    const dateStr = payload.when || payload.transactionDate || new Date().toISOString();
    const date = dateStr.substring(0, 10); // Lấy YYYY-MM-DD
    const bankAccountNo = (payload.subAccount || payload.accountNumber || "").toString().trim();

    if (!bankAccountNo) {
      logger.error(`[Webhook] Missing bankAccountNo in payload.`);
      throw new Error("Thiếu số tài khoản ngân hàng nhận tiền trong payload.");
    }

    if (amount <= 0) {
      logger.warn(`[Webhook] Transaction amount is 0 or negative. Ignored.`);
      return { success: false, message: "Số tiền giao dịch không hợp lệ." };
    }

    // Tìm user sở hữu tài khoản ngân hàng này
    const user = await User.findOne({ bankAccountNo });
    if (!user) {
      logger.error(`[Webhook] No user found with bankAccountNo: "${bankAccountNo}"`);
      throw new Error(`Không tìm thấy admin nào có tài khoản ngân hàng: ${bankAccountNo}`);
    }

    const ownerId = user._id.toString();
    const branchId = user.branchId ? String(user.branchId) : undefined;

    // Tìm học viên khớp với nội dung chuyển khoản
    const student = await this.matchStudentByDescription(description, ownerId, branchId);
    if (!student) {
      return { success: false, message: "Không khớp được học viên từ nội dung chuyển khoản." };
    }

    // Tính số tiền còn nợ
    const totalFee = parseInt(student.fee.replace(/\D/g, "")) || 0;
    const paidSoFar = student.paidAmount || 0;
    const remaining = totalFee - paidSoFar;

    if (remaining <= 0) {
      logger.info(`[Webhook] Student ${student.fullName} has already paid in full. No payment recorded.`);
      return { success: true, message: "Học viên đã hoàn thành học phí từ trước.", studentName: student.fullName };
    }

    // Giới hạn số tiền thanh toán không vượt quá số nợ
    const payAmount = Math.min(amount, remaining);

    // Ghi nhận thanh toán qua PaymentService
    const savedPayment = await PaymentService.createPayment(ownerId, {
      studentId: student._id.toString(),
      amount: payAmount,
      date,
      note: description || `Thanh toán tự động qua Webhook ngân hàng`,
      method: "Chuyển khoản",
    }, branchId);

    // Định dạng số tiền gửi qua SSE dạng VND
    const formattedAmount = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(payAmount);

    // Broadcast sự kiện qua SSE
    sseManager.broadcast(ownerId, "payment-received", {
      studentId: student._id.toString(),
      studentName: student.fullName,
      amount: formattedAmount,
      date,
    });

    return {
      success: true,
      message: "Ghi nhận thanh toán và thông báo realtime thành công.",
      paymentId: savedPayment._id,
      studentName: student.fullName,
      amount: payAmount,
    };
  }
}
