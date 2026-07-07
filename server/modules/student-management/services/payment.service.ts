import { Payment } from "../models/payment.model";
import { Student } from "../models/student.model";
import { IPayment } from "../interfaces/payment.interface";
import { logger } from "../config/logger";

interface PaymentFilters {
  page?: number | string;
  limit?: number | string;
  studentId?: string;
}

interface PaymentCreateData {
  studentId: string;
  amount: number | string;
  date: string;
  note?: string;
  method?: string;
  [key: string]: unknown;
}

interface PaymentHistoryEntry {
  id: string;
  amount: number;
  date: string;
  method: "Tiền mặt" | "Chuyển khoản";
  note?: string;
  recipient: string;
}

export class PaymentService {
  static async createPayment(ownerId: string | string[], data: PaymentCreateData): Promise<IPayment> {
    logger.info(`[Payment] Creating payment: studentId=${data.studentId}, ownerId=${ownerId}, amount=${data.amount}`);
    
    const studentQuery: Record<string, unknown> = { _id: data.studentId };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const student = await Student.findOne(studentQuery);
    if (!student) {
      logger.warn(`[Payment] Create payment failed - Student ${data.studentId} not found for ownerId=${ownerId}`);
      throw new Error("Không tìm thấy học viên.");
    }

    const payAmount = parseInt(String(data.amount));
    const totalFee = parseInt(student.fee.replace(/\D/g, ""));
    const paidSoFar = student.paidAmount || 0;
    const remaining = totalFee - paidSoFar;

    if (payAmount > remaining) {
      logger.warn(`[Payment] Create payment failed - Amount ${payAmount} exceeds remaining debt ${remaining} for student ${data.studentId}`);
      throw new Error("Số tiền đóng vượt quá số tiền còn nợ. Vui lòng kiểm tra lại!");
    }

    // Set ownerId of the payment record to the student's actual ownerId to maintain consistency
    const payment = new Payment({
      ...data,
      studentName: student.fullName,
      ownerId: student.ownerId,
    });
    const savedPayment = await payment.save();
    logger.info(`[Payment] Giao dịch thanh toán đã tạo: id=${savedPayment._id}, studentId=${savedPayment.studentId}`);

    // Update student paidAmount and append to paymentHistory array
    student.paidAmount = (student.paidAmount || 0) + payAmount;
    
    if (!student.paymentHistory) {
      student.paymentHistory = [];
    }
    student.paymentHistory.push({
      id: savedPayment._id.toString(),
      amount: payAmount,
      date: data.date,
      method: "Chuyển khoản",
      note: data.note,
      recipient: "Hệ thống",
    });

    // Tự động phân bổ số tiền thanh toán vào các đợt đóng học phí (installmentStatus) nếu có
    if (student.installmentStatus && student.installmentStatus.length > 0) {
      let allocated = payAmount;

      // Chiến lược 1: Khớp chính xác số tiền đợt chưa thu (ưu tiên quét QR)
      const exactMatch = student.installmentStatus.find(
        (inst) => inst.status !== 'Đã thu' && Math.abs(inst.amountDue - allocated) <= 1000
      );

      if (exactMatch) {
        exactMatch.status = 'Đã thu';
        exactMatch.amountDue = 0;
        exactMatch.paidAt = new Date().toISOString();
        logger.info(`[Payment] Khớp chính xác đợt ${exactMatch.installmentNo} với số tiền ${payAmount}`);
      } else {
        // Chiến lược 2: Phân bổ tuần tự (FIFO)
        const unpaidInstallments = student.installmentStatus
          .filter((inst) => inst.status !== 'Đã thu')
          .sort((a, b) => a.installmentNo - b.installmentNo);

        for (const inst of unpaidInstallments) {
          if (allocated <= 0) break;
          if (allocated >= inst.amountDue) {
            allocated -= inst.amountDue;
            inst.amountDue = 0;
            inst.status = 'Đã thu';
            inst.paidAt = new Date().toISOString();
          } else {
            inst.amountDue -= allocated;
            allocated = 0;
          }
        }
      }
      student.markModified('installmentStatus');
    }

    await student.save();
    logger.info(`[Payment] Cập nhật thông tin học phí thành công cho học viên: id=${student._id}, đã đóng=${student.paidAmount}`);

    return savedPayment;
  }

  static async getPayments(ownerId: string | string[], filters: PaymentFilters) {
    logger.info(`[Payment] Fetching payments for ownerId=${ownerId} with filters: ${JSON.stringify(filters)}`);
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (ownerId !== "ALL") {
      query.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (filters.studentId) query.studentId = filters.studentId;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    logger.info(`[Payment] Fetched ${payments.length} payments (total=${total}) for ownerId=${ownerId}`);
    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async deletePayment(ownerId: string | string[], id: string): Promise<IPayment | null> {
    logger.info(`[Payment] Deleting payment: id=${id}, ownerId=${ownerId}`);
    const paymentQuery: Record<string, unknown> = { _id: id };
    if (ownerId !== "ALL") {
      paymentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const payment = await Payment.findOne(paymentQuery);
    if (!payment) {
      logger.warn(`[Payment] Delete payment failed - Payment not found: id=${id}, ownerId=${ownerId}`);
      throw new Error("Không tìm thấy giao dịch thanh toán.");
    }

    const studentQuery: Record<string, unknown> = { _id: payment.studentId };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const student = await Student.findOne(studentQuery);
    if (student) {
      student.paidAmount = Math.max(0, (student.paidAmount || 0) - payment.amount);
      if (student.paymentHistory) {
        student.paymentHistory = (student.paymentHistory as PaymentHistoryEntry[]).filter(
          (p) => p.id !== payment._id.toString()
        );
      }
      await student.save();
      logger.info(`[Payment] Cập nhật hoàn tiền học phí thành công cho học viên: id=${student._id}`);
    }

    const deleted = await Payment.findOneAndDelete(paymentQuery);
    logger.info(`[Payment] Giao dịch thanh toán đã xóa thành công: id=${id}`);
    return deleted;
  }
}
