import assert from "node:assert/strict";
import type { Response } from "express";
import { afterEach, it, vi } from "vitest";
import { PaymentController } from "../controllers/payment.controller";
import { Payment } from "../models/payment.model";
import { Student } from "../models/student.model";
import { PaymentService } from "./payment.service";

const ownerScope = ["shared-owner"];
const branchA = "branch-a";
const branchB = "branch-b";

vi.mock("../utils/auth.util", async () => {
  const actual = await vi.importActual<typeof import("../utils/auth.util")>("../utils/auth.util");
  return { ...actual, getAllowedOwnerIds: vi.fn(async () => ownerScope) };
});

function responseCapture() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function expectedScope(extra: Record<string, unknown> = {}) {
  return { ...extra, ownerId: { $in: ownerScope }, branchId: branchA };
}

afterEach(() => vi.restoreAllMocks());

it("forwards the authenticated branch to all payment service actions", async () => {
  const create = vi.spyOn(PaymentService, "createPayment").mockResolvedValue({ _id: "payment-a" } as any);
  const list = vi.spyOn(PaymentService, "getPayments").mockResolvedValue({ payments: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  const remove = vi.spyOn(PaymentService, "deletePayment").mockResolvedValue({ _id: "payment-a" } as any);
  const user = { uid: "shared-owner", id: "shared-owner", email: "a@example.com", role: "admin", centerId: "ACME", branchId: branchA };
  const response = responseCapture();

  await PaymentController.create({ user, body: { studentId: "student-a", amount: 100, date: "2026-07-28" } } as any, response as unknown as Response);
  await PaymentController.getList({ user, query: {} } as any, response as unknown as Response, () => {});
  await PaymentController.delete({ user, params: { id: "payment-a" } } as any, response as unknown as Response);

  assert.equal(create.mock.calls[0]?.[2], branchA);
  assert.equal(list.mock.calls[0]?.[2], branchA);
  assert.equal(remove.mock.calls[0]?.[2], branchA);
});

it("lists only payments in the authenticated branch when owners overlap", async () => {
  const countDocuments = vi.spyOn(Payment as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Payment as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));

  await PaymentService.getPayments(ownerScope, {}, branchA);

  for (const rawQuery of [countDocuments.mock.calls[0]?.[0], find.mock.calls[0]?.[0]]) {
    const query = rawQuery as Record<string, unknown>;
    assert.deepEqual({ ...query, paidOn: undefined }, { ...expectedScope(), paidOn: undefined });
    const paidOn = query.paidOn as { $gte?: unknown; $lte?: unknown } | undefined;
    assert.ok(paidOn?.$gte instanceof Date);
    assert.ok(paidOn?.$lte instanceof Date);
  }
});

it("cannot create a payment for a same-owner student in another branch", async () => {
  let branchBStudentSaved = false;
  const branchBStudent = {
    fullName: "Student B", fee: "1000000", paidAmount: 0, ownerId: "shared-owner", branchId: branchB, paymentHistory: [],
    async save() { branchBStudentSaved = true; },
  };
  vi.spyOn(Payment.prototype as any, "save").mockImplementation(async function (this: any) {
    this._id = { toString: () => "payment-b" };
    return this;
  });
  const findOne = vi.spyOn(Student as any, "findOne").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? null : branchBStudent
  ));

  await assert.rejects(
    () => PaymentService.createPayment(ownerScope, { studentId: "student-b", amount: 100000, date: "2026-07-28" }, branchA),
    /h.c vi.n/i,
  );

  assert.deepEqual(findOne.mock.calls[0]?.[0], expectedScope({ _id: "student-b" }));
  assert.equal(branchBStudentSaved, false);
});

it("keeps branch scope on the final student update after creating a payment", async () => {
  const student = {
    _id: "student-a",
    fullName: "Student A",
    fee: "1000000",
    paidAmount: 0,
    ownerId: "shared-owner",
    branchId: branchA,
    paymentHistory: [],
    installmentStatus: [],
    async save() {},
  };
  vi.spyOn(Student as any, "findOne").mockResolvedValue(student);
  vi.spyOn(Payment.prototype as any, "save").mockImplementation(async function (this: any) { return this; });
  const updateStudent = vi.spyOn(Student as any, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

  await PaymentService.createPayment(ownerScope, { studentId: "student-a", amount: 100000, date: "2026-07-28" }, branchA);

  assert.deepEqual(updateStudent.mock.calls[0]?.[0], expectedScope({ _id: "student-a" }));
});

it("cannot delete a same-owner payment or mutate its student in another branch", async () => {
  const branchBPayment = { _id: { toString: () => "payment-b" }, studentId: "student-b", amount: 100000, branchId: branchB };
  let branchBStudentSaved = false;
  const branchBStudent = {
    paidAmount: 100000,
    paymentHistory: [{ id: "payment-b", amount: 100000 }],
    async save() { branchBStudentSaved = true; },
  };
  const findPayment = vi.spyOn(Payment as any, "findOne").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? null : branchBPayment
  ));
  const findStudent = vi.spyOn(Student as any, "findOne").mockResolvedValue(branchBStudent);
  const finalDelete = vi.spyOn(Payment as any, "findOneAndDelete").mockResolvedValue(branchBPayment);

  await assert.rejects(
    () => PaymentService.deletePayment(ownerScope, "payment-b", branchA),
    /thanh to.n/i,
  );

  assert.deepEqual(findPayment.mock.calls[0]?.[0], expectedScope({ _id: "payment-b" }));
  assert.equal(findStudent.mock.calls.length, 0);
  assert.equal(finalDelete.mock.calls.length, 0);
  assert.equal(branchBStudentSaved, false);
});

it("keeps branch scope on the student lookup and final payment delete predicate", async () => {
  const payment = { _id: { toString: () => "payment-a" }, studentId: "student-a", amount: 100000 };
  const student = { paidAmount: 100000, paymentHistory: [{ id: "payment-a", amount: 100000 }], async save() {} };
  const findPayment = vi.spyOn(Payment as any, "findOne").mockResolvedValue(payment);
  const findStudent = vi.spyOn(Student as any, "findOne").mockResolvedValue(student);
  const updateStudent = vi.spyOn(Student as any, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  const finalDelete = vi.spyOn(Payment as any, "findOneAndDelete").mockResolvedValue(payment);

  await PaymentService.deletePayment(ownerScope, "payment-a", branchA);

  assert.deepEqual(findPayment.mock.calls[0]?.[0], expectedScope({ _id: "payment-a" }));
  assert.deepEqual(findStudent.mock.calls[0]?.[0], expectedScope({ _id: "student-a" }));
  assert.deepEqual(updateStudent.mock.calls[0]?.[0], expectedScope({ _id: "student-a" }));
  assert.deepEqual(finalDelete.mock.calls[0]?.[0], expectedScope({ _id: "payment-a" }));
});
