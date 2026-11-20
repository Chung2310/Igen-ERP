import { afterEach, expect, it, vi } from "vitest";
import { appendFileSync } from "node:fs";
import { Student } from "../models/student.model";
import { Payment } from "../models/payment.model";
import { PaymentService } from "./payment.service";
vi.mock("./payment-transaction", () => ({ runStudentPaymentTransaction: async (work: (session: undefined) => Promise<unknown>) => work(undefined) }));

afterEach(() => vi.restoreAllMocks());

// Business oracle: every collected dong must reduce the scheduled debt by one dong.
// Run the real service. Only persistence is substituted, not its business decisions.
it.each([999000, 999500, 1000000, 1000500, 1001000])("tuition collection conserves money across installments: %s VND", async amount => {
  let stored: any = {
    _id: "learner-a", ownerId: "owner-a", branchId: "branch-a", fullName: "Nguyễn An",
    fee: "2.000.000", paidAmount: 0, paymentHistory: [],
    installmentStatus: [1, 2].map(installmentNo => ({ installmentNo, amountDue: 1000000, originalAmountDue: 1000000, status: "Chưa gửi" })),
  };
  const receipts: any[] = [];
  vi.spyOn(Student as any, "findOne").mockImplementation(async () => ({ ...structuredClone(stored), markModified: vi.fn() }));
  vi.spyOn(Student as any, "updateOne").mockImplementation(async (filter: any, update: any) => {
    expect(filter).toEqual({ _id: "learner-a", ownerId: "owner-a", branchId: "branch-a" });
    stored = { ...stored, ...structuredClone(update.$set) };
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 } as any;
  });
  vi.spyOn(Payment.prototype, "save").mockImplementation(async function (this: any) {
    receipts.push(this.toObject());
    return this;
  });
  await PaymentService.createPayment("owner-a", { studentId: "learner-a", amount, date: "2026-11-19", method: "Tiền mặt" }, "branch-a");
  const reloaded: any = await Student.findOne({ _id: "learner-a", ownerId: "owner-a", branchId: "branch-a" });
  if (process.env.STUDENT_BUSINESS_EVIDENCE) appendFileSync(process.env.STUDENT_BUSINESS_EVIDENCE, JSON.stringify({
    case: `Thu ${amount} đồng`, input: { amount, fee: 2000000, installments: [1000000, 1000000] },
    expected: { paidAmount: amount, scheduledDebt: 2000000 - amount },
    actual: { paidAmount: reloaded.paidAmount, scheduledDebt: reloaded.installmentStatus.reduce((sum: number, item: any) => sum + item.amountDue, 0) },
    savedReceipts: receipts, readBack: reloaded,
    limit: "Real PaymentService, mocked persistence. Read-back is from in-memory storage, not MongoDB.",
  }) + "\n", "utf8");
  expect(receipts).toHaveLength(1);
  expect(receipts[0].amount).toBe(amount);
  expect(reloaded.fee).toBe("2.000.000");
  expect(reloaded.paidAmount).toBe(amount);
  expect(reloaded.paymentHistory).toHaveLength(1);
  expect(reloaded.paymentHistory[0].amount).toBe(amount);
  expect(reloaded.installmentStatus.reduce((sum: number, item: any) => sum + item.amountDue, 0)).toBe(2000000 - amount);
  expect(reloaded.installmentStatus.every((item: any) => item.status !== "Đã thu" || item.amountDue === 0)).toBe(true);
});
