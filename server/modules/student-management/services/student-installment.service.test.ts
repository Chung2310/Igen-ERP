import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { StudentService } from "./student.service";

const ownerScope = ["shared-owner"];
const branchA = "branch-a";
const expectedScope = { ownerId: { $in: ownerScope }, branchId: branchA };

function studentRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: "student-a",
    fullName: "Student A",
    fee: "5.000.000",
    paidAmount: 1_000_000,
    ownerId: "shared-owner",
    branchId: branchA,
    installmentStatus: [],
    markModified: vi.fn(),
    save: vi.fn(async function (this: unknown) { return this; }),
    ...overrides,
  } as any;
}

afterEach(() => vi.restoreAllMocks());

it("adds a new installment to the total tuition and numbers it after existing installments", async () => {
  const scheduled = {
    installmentNo: 2, percent: 80, amountDue: 4_000_000, originalAmountDue: 4_000_000,
    status: "Chưa gửi", sentAt: "", paidAt: "", notificationId: "",
  };
  const student = studentRecord({ installmentStatus: [scheduled] });
  const findOne = vi.spyOn(Student as any, "findOne").mockResolvedValue(student);

  const created = await StudentService.createStudentInstallment(ownerScope, "student-a", { amountDue: 2_000_000 }, branchA);

  assert.deepEqual(findOne.mock.calls[0]?.[0], { _id: "student-a", ...expectedScope });
  assert.equal(student.fee, "7.000.000");
  assert.equal(scheduled.percent, 4_000_000 / 7_000_000 * 100);
  assert.equal(student.installmentStatus.length, 2);
  assert.deepEqual(created, {
    id: "3", studentName: "Student A", installmentNo: 3, amountDue: 2_000_000,
    totalFee: 7_000_000, status: "Chưa gửi", dueDate: "",
  });
  assert.equal(student.installmentStatus[1].originalAmountDue, 2_000_000);
  assert.equal(student.save.mock.calls.length, 1);
});

it("rejects a new installment when the current fee already fails to cover paid and scheduled tuition", async () => {
  const student = studentRecord({ installmentStatus: [{
    installmentNo: 1, percent: 110, amountDue: 5_500_000, status: "Chưa gửi",
  }] });
  vi.spyOn(Student as any, "findOne").mockResolvedValue(student);

  await assert.rejects(
    () => StudentService.createStudentInstallment(ownerScope, "student-a", { amountDue: 1_000_000 }, branchA),
    /Tổng học phí sau khi thêm đợt không đủ/,
  );

  assert.equal(student.save.mock.calls.length, 0);
  assert.equal(student.installmentStatus.length, 1);
});

it("changes an unpaid installment amount together with the student total", async () => {
  const installment = {
    installmentNo: 1, percent: 100, amountDue: 5_000_000, originalAmountDue: 5_000_000,
    status: "Chưa gửi", sentAt: "", paidAt: "", notificationId: "",
  };
  const student = studentRecord({ fee: "5.000.000", paidAmount: 0, installmentStatus: [installment] });
  const findOne = vi.spyOn(Student as any, "findOne").mockResolvedValue(student);

  const updated = await StudentService.updateStudentInstallment(ownerScope, "student-a", 1, { amountDue: 4_000_000 }, branchA);

  assert.deepEqual(findOne.mock.calls[0]?.[0], { _id: "student-a", ...expectedScope });
  assert.equal(student.fee, "4.000.000");
  assert.equal(installment.amountDue, 4_000_000);
  assert.equal(installment.originalAmountDue, 4_000_000);
  assert.equal(updated.totalFee, 4_000_000);
  assert.equal(student.save.mock.calls.length, 1);
});

it.each([
  { status: "Đã thu", amountDue: 5_000_000, originalAmountDue: 5_000_000, message: /Không thể sửa đợt học phí đã thu/ },
  { status: "Đã gửi", amountDue: 4_000_000, originalAmountDue: 5_000_000, message: /đã phát sinh thanh toán một phần/ },
  { status: "Đã gửi", amountDue: 5_000_000, originalAmountDue: undefined, message: /đã phát sinh thanh toán một phần/ },
])("blocks amount edits on paid, partially paid, or legacy installments", async ({ status, amountDue, originalAmountDue, message }) => {
  const installment = { installmentNo: 1, percent: 100, amountDue, originalAmountDue, status };
  const student = studentRecord({ fee: "5.000.000", paidAmount: 0, installmentStatus: [installment] });
  vi.spyOn(Student as any, "findOne").mockResolvedValue(student);

  await assert.rejects(
    () => StudentService.updateStudentInstallment(ownerScope, "student-a", 1, { amountDue: 4_000_000 }, branchA),
    message,
  );

  assert.equal(student.save.mock.calls.length, 0);
  assert.equal(installment.amountDue, amountDue);
});

it("allows a due-date correction on an installment with a prior partial payment", async () => {
  const installment = {
    installmentNo: 1, percent: 100, amountDue: 4_000_000, originalAmountDue: 5_000_000,
    status: "Đã gửi", sentAt: "", paidAt: "", notificationId: "",
  };
  const student = studentRecord({ fee: "5.000.000", paidAmount: 1_000_000, installmentStatus: [installment] });
  vi.spyOn(Student as any, "findOne").mockResolvedValue(student);

  const updated = await StudentService.updateStudentInstallment(ownerScope, "student-a", 1, { dueDate: "2026-12-15" }, branchA);

  assert.equal(updated.dueDate, "2026-12-15");
  assert.equal(installment.amountDue, 4_000_000);
  assert.equal(student.fee, "5.000.000");
  assert.equal(student.save.mock.calls.length, 1);
});

it("does not find or mutate a same-owner student from another branch", async () => {
  const branchBStudent = studentRecord({ branchId: "branch-b" });
  const findOne = vi.spyOn(Student as any, "findOne").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? null : branchBStudent
  ));

  const result = await StudentService.createStudentInstallment(ownerScope, "student-b", { amountDue: 1_000_000 }, branchA);

  assert.equal(result, null);
  assert.deepEqual(findOne.mock.calls[0]?.[0], { _id: "student-b", ...expectedScope });
  assert.equal(branchBStudent.save.mock.calls.length, 0);
  assert.equal(branchBStudent.installmentStatus.length, 0);
});
