import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Payment } from "../models/payment.model";
import { Student } from "../models/student.model";
import { PaymentService } from "./payment.service";

const ownerId = "owner-a";
const branchId = "branch-a";
const studentId = new mongoose.Types.ObjectId().toString();
let replSet: MongoMemoryReplSet;

async function createStudent() {
  return Student.create({
    _id: studentId,
    fullName: "Nguyễn An",
    phone: "0900000000",
    registrationDate: "2026-01-01",
    fee: "2.000.000",
    paidAmount: 0,
    ownerId,
    branchId,
    paymentHistory: [],
    installmentStatus: [1, 2].map((installmentNo) => ({
      installmentNo,
      percent: 50,
      amountDue: 1_000_000,
      originalAmountDue: 1_000_000,
      status: "Chưa gửi",
      sentAt: "",
      notificationId: "",
      paidAt: "",
    })),
  });
}

describe("student tuition payment deletion", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await Promise.all([Payment.deleteMany({}), Student.deleteMany({})]);
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  it.each([500_000, 1_000_000])("restores the exact installment allocation when deleting a %s VND receipt", async (amount) => {
    await createStudent();
    const payment: any = await PaymentService.createPayment(ownerId, { studentId, amount, date: "2026-11-19", method: "Tiền mặt" }, branchId);

    expect(payment.installmentAllocations.map((allocation: any) => allocation.toObject())).toEqual([{ installmentNo: 1, amount }]);
    await PaymentService.deletePayment(ownerId, String(payment._id), branchId);

    const saved: any = await Student.findById(studentId).lean();
    expect(await Payment.countDocuments({ _id: payment._id })).toBe(0);
    expect(saved.paidAmount).toBe(0);
    expect(saved.paymentHistory).toHaveLength(0);
    expect(saved.installmentStatus.map((item: any) => ({ amountDue: item.amountDue, status: item.status }))).toEqual([
      { amountDue: 1_000_000, status: "Chưa gửi" },
      { amountDue: 1_000_000, status: "Chưa gửi" },
    ]);
  });

  it("rolls back student and receipt changes if the receipt deletion fails", async () => {
    await createStudent();
    const payment: any = await PaymentService.createPayment(ownerId, { studentId, amount: 500_000, date: "2026-11-19", method: "Tiền mặt" }, branchId);
    vi.spyOn(Payment, "findOneAndDelete").mockRejectedValueOnce(new Error("delete failed"));

    await expect(PaymentService.deletePayment(ownerId, String(payment._id), branchId)).rejects.toThrow("delete failed");

    const saved: any = await Student.findById(studentId).lean();
    expect(await Payment.countDocuments({ _id: payment._id })).toBe(1);
    expect(saved.paidAmount).toBe(500_000);
    expect(saved.paymentHistory).toHaveLength(1);
    expect(saved.installmentStatus[0].amountDue).toBe(500_000);
  });

  it("blocks deletion of a legacy receipt when installment allocation cannot be proven", async () => {
    const student: any = await createStudent();
    const payment: any = await Payment.create({ studentId, studentName: student.fullName, amount: 1_000_000, method: "Tiền mặt", date: "2026-11-19", ownerId, branchId });
    student.paidAmount = 1_000_000;
    student.paymentHistory = [{ id: String(payment._id), amount: 1_000_000, date: payment.date, method: payment.method, recipient: "Hệ thống" }];
    student.installmentStatus[0].amountDue = 0;
    student.installmentStatus[0].status = "Đã thu";
    await student.save();

    await expect(PaymentService.deletePayment(ownerId, String(payment._id), branchId)).rejects.toMatchObject({ statusCode: 409, code: "PAYMENT_INSTALLMENT_ALLOCATION_UNKNOWN" });
    expect(await Payment.exists({ _id: payment._id })).toBeTruthy();
    expect((await Student.findById(studentId).lean())?.paidAmount).toBe(1_000_000);
  });
});
