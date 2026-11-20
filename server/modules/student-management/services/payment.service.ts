import { Payment } from "../models/payment.model";
import { Student } from "../models/student.model";
import { IPayment } from "../interfaces/payment.interface";
import { logger } from "../config/logger";
import { parsePaymentDate } from "../utils/payment-date.util";
import { resolveOwnerFilter } from "../utils/auth.util";
import type { ClientSession } from "mongoose";
import { runStudentPaymentTransaction } from "./payment-transaction";

interface PaymentFilters {
  page?: number | string;
  limit?: number | string;
  studentId?: string;
  ownerFilter?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface PaymentCreateData {
  studentId: string;
  amount: number | string;
  date: string;
  note?: string;
  method?: "Tiền mặt" | "Chuyển khoản";
  [key: string]: unknown;
}

interface PaymentUpdateData {
  expectedVersion?: number;
  method?: "Tiền mặt" | "Chuyển khoản";
  date?: string;
  note?: string;
}

interface PaymentHistoryEntry {
  id: string;
  amount: number;
  date: string;
  method: "Tiền mặt" | "Chuyển khoản";
  note?: string;
  recipient: string;
}

function buildBranchScopeQuery(branchId?: string) {
  return branchId ? { branchId } : {};
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PaymentService {
  static async reconcileStudent(ownerId: string | string[], studentId: string, branchId?: string) {
    const scope = { ...buildBranchScopeQuery(branchId), ...(ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId }) };
    const student = await Student.findOne({ _id: studentId, ...scope }).lean();
    if (!student) throw Object.assign(new Error("Không tìm thấy học viên trong phạm vi được phép."), { status: 404 });
    const receiptSummary = await Payment.aggregate<{ total: number; count: number }>([
      { $match: { studentId, ...scope } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const receiptTotal = receiptSummary[0]?.total || 0;
    const historyTotal = (student.paymentHistory || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const recordedPaidAmount = Number(student.paidAmount || 0);
    const totalFee = Number(String(student.fee || "0").replace(/\D/g, ""));
    const matched = receiptTotal === recordedPaidAmount && historyTotal === recordedPaidAmount;
    return { studentName: student.fullName, totalFee, recordedPaidAmount, receiptTotal, historyTotal,
      remainingAmount: totalFee - recordedPaidAmount, paymentDifference: receiptTotal - recordedPaidAmount,
      receiptCount: receiptSummary[0]?.count || 0,
      reconciliationStatus: matched ? "Số liệu khớp" : "Có chênh lệch, cần kiểm tra chứng từ. Chưa xác định nguyên nhân và chưa điều chỉnh dữ liệu.",
      scopeDescription: "Đối chiếu toàn bộ lịch sử của học viên trong chi nhánh hiện tại, không phải số thu riêng một kỳ.",
    };
  }

  static async createPayment(ownerId: string | string[], data: PaymentCreateData, branchId?: string): Promise<IPayment> {
    return runStudentPaymentTransaction(session => this.createPaymentInTransaction(ownerId, data, branchId, session));
  }

  private static async createPaymentInTransaction(ownerId: string | string[], data: PaymentCreateData, branchId: string | undefined, session: ClientSession): Promise<IPayment> {
    logger.info(`[Payment] Creating payment: studentId=${data.studentId}, ownerId=${ownerId}, amount=${data.amount}`);
    
    const studentQuery: Record<string, unknown> = {
      _id: data.studentId,
      ...buildBranchScopeQuery(branchId),
    };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const student = await Student.findOne(studentQuery, null, { session });
    if (!student) {
      logger.warn(`[Payment] Create payment failed - Student ${data.studentId} not found for ownerId=${ownerId}`);
      throw new Error("Không tìm thấy học viên.");
    }

    const payAmount = Number(data.amount);
    if (!Number.isSafeInteger(payAmount) || payAmount <= 0) throw new Error("Số tiền thu phải là số nguyên dương hợp lệ.");
    const totalFee = parseInt(student.fee.replace(/\D/g, ""));
    const paidSoFar = student.paidAmount || 0;
    if (!Number.isSafeInteger(totalFee) || totalFee < 0 || !Number.isSafeInteger(paidSoFar) || paidSoFar < 0) throw new Error("Học phí hoặc số đã đóng trên hồ sơ không hợp lệ. Cần kiểm tra trước khi thu.");
    const remaining = totalFee - paidSoFar;

    if (payAmount > remaining) {
      logger.warn(`[Payment] Create payment failed - Amount ${payAmount} exceeds remaining debt ${remaining} for student ${data.studentId}`);
      throw new Error("Số tiền đóng vượt quá số tiền còn nợ. Vui lòng kiểm tra lại!");
    }

    // Set ownerId of the payment record to the student's actual ownerId to maintain consistency
    // paidOn là trục thời gian dùng cho báo cáo. Nếu không quy đổi được `date`
    // (dữ liệu gọi từ nơi chưa qua validation) thì để trống thay vì lấy ngày hôm
    // nay — giao dịch sẽ bị loại khỏi báo cáo, còn hơn rơi sai kỳ mà không ai biết.
    const payment = new Payment({
      ...data,
      paidOn: parsePaymentDate(data.date) ?? undefined,
      studentName: student.fullName,
      ownerId: student.ownerId,
      branchId: student.branchId,
    });
    const installmentAllocations: Array<{ installmentNo: number; amount: number }> = [];

    // Update student paidAmount and append to paymentHistory array
    student.paidAmount = (student.paidAmount || 0) + payAmount;
    
    if (!student.paymentHistory) {
      student.paymentHistory = [];
    }

    // Tự động phân bổ số tiền thanh toán vào các đợt đóng học phí (installmentStatus) nếu có
    if (student.installmentStatus && student.installmentStatus.length > 0) {
      let allocated = payAmount;

      // Chiến lược 1: Khớp chính xác số tiền đợt chưa thu (ưu tiên quét QR)
      const exactMatch = student.installmentStatus.find(
        (inst) => inst.status !== 'Đã thu' && inst.amountDue === allocated
      );

      if (exactMatch) {
        installmentAllocations.push({ installmentNo: exactMatch.installmentNo, amount: allocated });
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
            if (inst.amountDue > 0) installmentAllocations.push({ installmentNo: inst.installmentNo, amount: inst.amountDue });
            allocated -= inst.amountDue;
            inst.amountDue = 0;
            inst.status = 'Đã thu';
            inst.paidAt = new Date().toISOString();
          } else {
            installmentAllocations.push({ installmentNo: inst.installmentNo, amount: allocated });
            inst.amountDue -= allocated;
            allocated = 0;
          }
        }
      }
      student.markModified('installmentStatus');
    }

    payment.installmentAllocations = installmentAllocations;
    const savedPayment = await payment.save({ session });
    logger.info(`[Payment] Giao dịch thanh toán đã tạo: id=${savedPayment._id}, studentId=${savedPayment.studentId}`);
    student.paymentHistory.push({
      id: savedPayment._id.toString(),
      amount: payAmount,
      date: data.date,
      method: data.method || "Tiền mặt",
      note: data.note,
      recipient: "Hệ thống",
    });

    await Student.updateOne(
      studentQuery,
      {
        $set: {
          paidAmount: student.paidAmount,
          paymentHistory: student.paymentHistory,
          installmentStatus: student.installmentStatus,
        },
      },
      { runValidators: true, session },
    );
    logger.info(`[Payment] Cập nhật thông tin học phí thành công cho học viên: id=${student._id}, đã đóng=${student.paidAmount}`);

    return savedPayment;
  }

  static async getPayments(ownerId: string | string[], filters: PaymentFilters, branchId?: string) {
    logger.info(`[Payment] Fetching payments for ownerId=${ownerId} with filters: ${JSON.stringify(filters)}`);
    const page = Math.max(1, filters.page ? parseInt(String(filters.page)) || 1 : 1);
    const limit = Math.min(5000, Math.max(1, filters.limit ? parseInt(String(filters.limit)) || 100 : 100));
    const skip = (page - 1) * limit;
    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = {
      ...buildBranchScopeQuery(branchId),
    };
    if (resolvedOwnerId !== "ALL") {
      query.ownerId = Array.isArray(resolvedOwnerId) ? { $in: resolvedOwnerId } : resolvedOwnerId;
    }
    if (filters.studentId) query.studentId = filters.studentId;
    if (filters.search?.trim()) {
      const expression = new RegExp(escapeRegex(filters.search.trim().slice(0, 120)), "i");
      query.$or = [{ studentName: expression }, { note: expression }];
    }

    const startDate = parsePaymentDate(filters.startDate);
    const endDate = parsePaymentDate(filters.endDate);
    if (startDate && endDate && startDate > endDate) throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
    if (startDate || endDate) {
      const range: Record<string, Date> = {};
      if (startDate) range.$gte = startDate;
      if (endDate) {
        const rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
        range.$lte = rangeEnd;
      }
      query.paidOn = range;
    }

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

  static async updatePayment(ownerId: string | string[], id: string, data: PaymentUpdateData, branchId?: string): Promise<IPayment> {
    return runStudentPaymentTransaction(session => this.updatePaymentInTransaction(ownerId, id, data, branchId, session));
  }

  private static async updatePaymentInTransaction(ownerId: string | string[], id: string, data: PaymentUpdateData, branchId: string | undefined, session: ClientSession): Promise<IPayment> {
    const paymentQuery: Record<string, unknown> = { _id: id, ...buildBranchScopeQuery(branchId) };
    if (ownerId !== "ALL") paymentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    const paymentFind = Payment.findOne(paymentQuery);
    if (session) paymentFind.session(session);
    const payment = await paymentFind;
    if (!payment) throw new Error("Không tìm thấy giao dịch thanh toán.");
    if (data.expectedVersion !== undefined && data.expectedVersion !== (payment.__v ?? 0)) {
      throw new Error("Giao dịch đã được cập nhật ở nơi khác. Hãy tra cứu lại rồi thử lại.");
    }

    const studentQuery: Record<string, unknown> = { _id: payment.studentId, ...buildBranchScopeQuery(branchId) };
    if (ownerId !== "ALL") studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    const studentFind = Student.findOne(studentQuery);
    if (session) studentFind.session(session);
    const student = await studentFind;
    if (!student) throw new Error("Không tìm thấy học viên liên kết với giao dịch.");
    const history = (student.paymentHistory || []) as PaymentHistoryEntry[];
    const entry = history.find((item) => item.id === payment._id.toString());
    if (!entry) throw new Error("Lịch sử học phí của học viên không khớp giao dịch; chưa thể sửa an toàn.");

    const update: Record<string, unknown> = {};
    if (data.method !== undefined) update.method = data.method;
    if (data.date !== undefined) {
      const paidOn = parsePaymentDate(data.date);
      if (!paidOn) throw new Error("Ngày thanh toán không hợp lệ.");
      update.date = data.date;
      update.paidOn = paidOn;
      entry.date = data.date;
    }
    if (data.method !== undefined) entry.method = data.method;
    if (data.note !== undefined) {
      update.note = data.note;
      entry.note = data.note;
    }

    const version = payment.__v ?? 0;
    const updatedPayment = await Payment.findOneAndUpdate(
      { ...paymentQuery, ...(data.expectedVersion === undefined ? {} : { __v: version }) },
      { $set: update, $inc: { __v: 1 } },
      { returnDocument: "after", runValidators: true, session },
    );
    if (!updatedPayment) throw new Error("Giao dịch đã được cập nhật ở nơi khác. Hãy tra cứu lại rồi thử lại.");
    const studentUpdate = await Student.updateOne(studentQuery, { $set: { paymentHistory: history } }, { runValidators: true, session });
    if (studentUpdate.matchedCount !== 1) throw new Error("Lịch sử học phí vừa thay đổi. Hãy tải lại giao dịch trước khi cập nhật.");
    return updatedPayment;
  }

  static async deletePayment(ownerId: string | string[], id: string, branchId?: string): Promise<IPayment | null> {
    return runStudentPaymentTransaction(session => this.deletePaymentInTransaction(ownerId, id, branchId, session));
  }

  private static async deletePaymentInTransaction(ownerId: string | string[], id: string, branchId: string | undefined, session: ClientSession): Promise<IPayment | null> {
    logger.info(`[Payment] Deleting payment: id=${id}, ownerId=${ownerId}`);
    const paymentQuery: Record<string, unknown> = {
      _id: id,
      ...buildBranchScopeQuery(branchId),
    };
    if (ownerId !== "ALL") {
      paymentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const paymentFind = Payment.findOne(paymentQuery);
    if (session) paymentFind.session(session);
    const payment = await paymentFind;
    if (!payment) {
      logger.warn(`[Payment] Delete payment failed - Payment not found: id=${id}, ownerId=${ownerId}`);
      throw new Error("Không tìm thấy giao dịch thanh toán.");
    }

    const studentQuery: Record<string, unknown> = {
      _id: payment.studentId,
      ...buildBranchScopeQuery(branchId),
    };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    const studentFind = Student.findOne(studentQuery);
    if (session) studentFind.session(session);
    const student = await studentFind;
    if (!student) throw new Error("Không tìm thấy học viên liên kết với giao dịch. Giao dịch chưa bị xóa để giữ nguyên đối soát.");
    const history = (student.paymentHistory || []) as PaymentHistoryEntry[];
    const historyEntry = history.find((entry) => entry.id === payment._id.toString());
    if (!historyEntry || Number(historyEntry.amount) !== Number(payment.amount)) throw Object.assign(new Error("Lịch sử học phí không khớp giao dịch. Giao dịch chưa bị xóa để giữ nguyên đối soát."), { statusCode: 409, code: "PAYMENT_HISTORY_MISMATCH" });

    const allocations = (payment as any).installmentAllocations as Array<{ installmentNo: number; amount: number }> | undefined;
    const installments = (student.installmentStatus || []) as Array<{ installmentNo: number; amountDue: number; originalAmountDue?: number; status: string; sentAt?: string; notificationId?: string; paidAt?: string }>;
    if (installments.length && !Array.isArray(allocations)) {
      throw Object.assign(new Error("Giao dịch cũ chưa lưu phân bổ vào từng đợt học phí. Hãy đối soát lịch thu trước khi xóa giao dịch."), { statusCode: 409, code: "PAYMENT_INSTALLMENT_ALLOCATION_UNKNOWN" });
    }
    for (const allocation of allocations || []) {
      if (!Number.isSafeInteger(allocation.amount) || allocation.amount <= 0) throw Object.assign(new Error("Phân bổ học phí của giao dịch không hợp lệ. Cần đối soát trước khi xóa."), { statusCode: 409, code: "PAYMENT_INSTALLMENT_ALLOCATION_INVALID" });
      const installment = installments.find((item) => item.installmentNo === allocation.installmentNo);
      if (!installment || !Number.isSafeInteger(installment.amountDue) || installment.amountDue < 0) throw Object.assign(new Error("Không tìm thấy đợt học phí được giao dịch phân bổ. Cần đối soát trước khi xóa."), { statusCode: 409, code: "PAYMENT_INSTALLMENT_ALLOCATION_MISMATCH" });
      const restoredAmount = installment.amountDue + allocation.amount;
      if (Number.isSafeInteger(installment.originalAmountDue) && restoredAmount > Number(installment.originalAmountDue)) throw Object.assign(new Error("Số tiền hoàn lại vượt số gốc của đợt học phí. Cần đối soát trước khi xóa."), { statusCode: 409, code: "PAYMENT_INSTALLMENT_ALLOCATION_MISMATCH" });
      installment.amountDue = restoredAmount;
      installment.status = installment.sentAt || installment.notificationId ? "Đã gửi" : "Chưa gửi";
      installment.paidAt = "";
    }
    const paidAmount = Number(student.paidAmount || 0);
    if (!Number.isSafeInteger(paidAmount) || paidAmount < Number(payment.amount)) throw Object.assign(new Error("Số đã đóng trên hồ sơ không đủ để hoàn giao dịch này. Cần đối soát trước khi xóa."), { statusCode: 409, code: "PAYMENT_BALANCE_MISMATCH" });
    const updateStudent = await Student.updateOne(
      studentQuery,
      { $set: { paidAmount: paidAmount - Number(payment.amount), paymentHistory: history.filter((entry) => entry.id !== payment._id.toString()), installmentStatus: installments } },
      { runValidators: true, session },
    );
    if (updateStudent.matchedCount !== 1) throw new Error("Hồ sơ học viên vừa thay đổi. Giao dịch chưa bị xóa.");
    const deleted = await Payment.findOneAndDelete(paymentQuery, { session });
    if (!deleted) throw new Error("Giao dịch vừa thay đổi. Hãy tải lại danh sách trước khi xóa.");
    logger.info(`[Payment] Giao dịch thanh toán đã xóa thành công: id=${id}`);
    return deleted;
  }
}
