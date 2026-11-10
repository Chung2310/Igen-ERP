import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { StudentService } from "./student.service";

afterEach(() => vi.restoreAllMocks());

it("allows duplicate CCCD values and flags duplicate emails", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({
    select: async () => [{ phone: "0900000000", email: "used@example.com", idCard: "001002003004" }],
  });

  const result = await StudentService.previewBulkStudents("owner-a", [
    { sourceRow: 2, fullName: "Existing", phone: "0910000001", email: "used@example.com", idCard: "001 002 003 004" },
    { sourceRow: 3, fullName: "First", phone: "0910000002", email: "first@example.com", idCard: "005006007008" },
    { sourceRow: 4, fullName: "Duplicate", phone: "0910000003", email: "first@example.com", idCard: "005 006 007 008" },
  ]);

  assert.deepEqual(result.errors.map(({ index, row, reason }) => ({ index, row, reason })), [
    { index: 0, row: 2, reason: "Email đã tồn tại trong trung tâm hiện tại." },
    { index: 2, row: 4, reason: "Email bị trùng lặp trong file import." },
  ]);
});

it("flags invalid phone, email, and tuition amount formats during preview", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({
    select: async () => [],
  });

  const result = await StudentService.previewBulkStudents("owner-a", [
    { sourceRow: 8, fullName: "Invalid row", phone: "0123456789", email: "not-an-email", fee: "1.5", paidAmount: "0" },
  ]);

  assert.deepEqual(result.errors.map(({ row, reason }) => ({ row, reason })), [
    { row: 8, reason: "Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09)." },
    { row: 8, reason: "Định dạng email không hợp lệ." },
    { row: 8, reason: "Học phí phải là số nguyên không âm." },
  ]);
});

it("skips invalid tuition instead of silently turning it into another amount", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({ select: async () => [] });
  const insertMany = vi.spyOn(Student as any, "insertMany");

  const result = await StudentService.bulkCreateStudents("creator-a", "owner-a", [
    { sourceRow: 9, fullName: "Invalid amount", phone: "0910000001", email: "valid@example.com", fee: "1.5", paidAmount: "0" },
  ]);

  assert.equal(result.importedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.ok(result.errors.some(({ reason }) => reason === "Học phí phải là số nguyên không âm."));
  assert.equal(insertMany.mock.calls.length, 0);
});

it("persists tuition from a new student import for the Fees page", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({ select: async () => [] });
  const insertedStudents: any[] = [];
  vi.spyOn(Student as any, "insertMany").mockImplementation(async (students: any[]) => {
    insertedStudents.push(...students);
    return students.map((student, index) => ({
      ...student,
      _id: { toString: () => `student-${index}` },
    }));
  });

  const result = await StudentService.bulkCreateStudents("creator-a", "owner-a", [
    { sourceRow: 2, fullName: "Tuition Learner", phone: "0910000001", email: "tuition@example.com", fee: "1.500.000", feeProvided: true, paidAmount: 0 },
  ]);

  assert.equal(result.importedCount, 1);
  assert.equal(result.updatedFeeCount, 0);
  assert.equal(insertedStudents[0]?.fee, "1.500.000");
  assert.equal(String(insertedStudents[0]?.fee).replace(/\D/g, ""), "1500000");
});

it("checks class capacity including earlier rows in the same import", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({ select: async () => [] });
  vi.spyOn(Batch as any, "find").mockReturnValue({
    select: async () => [{ _id: "batch-a", code: "A-01", courseId: "course-a", quota: 0, learnerIds: [] }],
  });
  vi.spyOn(Course as any, "find").mockReturnValue({
    select: () => ({ lean: async () => [{ _id: "course-a", maxLearners: 1 }] }),
  });

  const result = await StudentService.previewBulkStudents("owner-a", [
    { sourceRow: 2, fullName: "First", phone: "0910000001", email: "first@example.com", fee: "0", batchCode: "A-01" },
    { sourceRow: 3, fullName: "Second", phone: "0910000002", email: "second@example.com", fee: "0", batchCode: "A-01" },
  ]);

  assert.deepEqual(result.errors.map(({ index, row, reason }) => ({ index, row, reason })), [
    { index: 1, row: 3, reason: "Lớp đã đạt sĩ số tối đa (1 học viên)." },
  ]);
});

it("bulk import allows repeated CCCD values", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({ select: async () => [] });
  vi.spyOn(Student as any, "insertMany").mockImplementation(async (students: any[]) => students.map((student, index) => ({
    ...student,
    _id: { toString: () => `student-${index}` },
  })));

  const result = await StudentService.bulkCreateStudents("creator-a", "owner-a", [
    { sourceRow: 2, fullName: "First", phone: "0910000001", email: "first@example.com", idCard: "005006007008", fee: "0" },
    { sourceRow: 3, fullName: "Duplicate", phone: "0910000002", email: "duplicate@example.com", idCard: "005 006 007 008", fee: "0" },
  ]);

  assert.equal(result.importedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.deepEqual(result.errors, []);
});
