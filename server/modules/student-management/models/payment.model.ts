import { Schema, model } from "mongoose";
import { IPayment } from "../interfaces/payment.interface";

const paymentSchema = new Schema<IPayment>(
  {
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["Tiền mặt", "Chuyển khoản"], required: true },
    // Hiển thị cho người dùng — lịch sử lưu DD/MM/YYYY, không dùng để lọc/sắp xếp
    date: { type: String, required: true },
    // Ngày thu tiền đã chuẩn hóa — nguồn duy nhất để gom nhóm theo thời gian
    // trong báo cáo. Xem utils/payment-date.util.ts
    paidOn: { type: Date, index: true },
    note: { type: String, default: "" },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

export const Payment = model<IPayment>("Payment", paymentSchema);
