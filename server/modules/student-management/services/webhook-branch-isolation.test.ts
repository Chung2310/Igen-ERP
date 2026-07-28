import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { PaymentService } from "./payment.service";
import { sseManager } from "./sse.manager";
import { WebhookService } from "./webhook.service";

const ownerId = "507f1f77bcf86cd799439011";
const branchA = "branch-a";
const branchB = "branch-b";
const studentBId = "507f1f77bcf86cd799439012";

function mockCompanyUsers(branchId?: string) {
  vi.spyOn(User as any, "findById").mockResolvedValue({
    _id: ownerId,
    companyCode: "ACME",
    branchId,
  });
  vi.spyOn(User as any, "find").mockImplementation(() => ({
    select: async () => [
      { _id: { toString: () => ownerId } },
      { _id: { toString: () => "507f1f77bcf86cd799439099" } },
    ],
  }));
}

afterEach(() => vi.restoreAllMocks());

it("does not match a same-company branch-B student by ID for a branch-A webhook user", async () => {
  mockCompanyUsers(branchA);
  const branchBStudent = { _id: studentBId, fullName: "Student B", ownerId, branchId: branchB };
  const findOne = vi.spyOn(Student as any, "findOne").mockImplementation((query: Record<string, unknown>) => {
    if (query.branchId === branchA) return Promise.resolve(null);
    return Promise.resolve(branchBStudent);
  });
  vi.spyOn(Student as any, "findById").mockImplementation(() => ({
    select: async () => branchBStudent,
  }));
  vi.spyOn(Student as any, "find").mockResolvedValue([]);

  const matched = await WebhookService.matchStudentByDescription(
    "PAY " + studentBId,
    ownerId,
    branchA,
  );

  assert.equal(matched, null);
  assert.deepEqual(findOne.mock.calls[0]?.[0], {
    _id: studentBId,
    ownerId: { $in: [ownerId, "507f1f77bcf86cd799439099"] },
    branchId: branchA,
  });
});

it("does not match a same-company branch-B student by phone for a branch-A webhook user", async () => {
  mockCompanyUsers(branchA);
  const branchBStudent = {
    _id: studentBId,
    fullName: "Student B",
    phone: "0900000000",
    ownerId,
    branchId: branchB,
  };
  const find = vi.spyOn(Student as any, "find").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? [] : [branchBStudent]
  ));

  const matched = await WebhookService.matchStudentByDescription(
    "PAY 0900000000",
    ownerId,
    branchA,
  );

  assert.equal(matched, null);
  assert.deepEqual(find.mock.calls[0]?.[0], {
    ownerId: { $in: [ownerId, "507f1f77bcf86cd799439099"] },
    branchId: branchA,
  });
});

it("propagates the bank-account user branch through matching and payment creation", async () => {
  const webhookUser = {
    _id: { toString: () => ownerId },
    branchId: branchA,
  };
  vi.spyOn(User as any, "findOne").mockResolvedValue(webhookUser);
  const student = {
    _id: { toString: () => studentBId },
    fullName: "Student A",
    fee: "1000000",
    paidAmount: 0,
  };
  const match = vi.spyOn(WebhookService, "matchStudentByDescription").mockResolvedValue(student as any);
  const createPayment = vi.spyOn(PaymentService, "createPayment").mockResolvedValue({ _id: "payment-a" } as any);
  vi.spyOn(sseManager, "broadcast").mockImplementation(() => undefined);

  await WebhookService.processIncomingTransaction({
    description: "PAY 0900000000",
    amount: 100000,
    accountNumber: "123456",
    transactionDate: "2026-07-28T10:00:00Z",
  });

  assert.deepEqual(match.mock.calls[0], ["PAY 0900000000", ownerId, branchA]);
  assert.equal(createPayment.mock.calls[0]?.[2], branchA);
});

it("preserves unscoped matching for a genuinely branchless webhook user", async () => {
  mockCompanyUsers();
  const branchBStudent = {
    _id: studentBId,
    fullName: "Student B",
    phone: "0900000000",
    ownerId,
    branchId: branchB,
  };
  const find = vi.spyOn(Student as any, "find").mockResolvedValue([branchBStudent]);

  const matched = await WebhookService.matchStudentByDescription("PAY 0900000000", ownerId);

  assert.equal(matched, branchBStudent);
  assert.deepEqual(find.mock.calls[0]?.[0], {
    ownerId: { $in: [ownerId, "507f1f77bcf86cd799439099"] },
  });
});
