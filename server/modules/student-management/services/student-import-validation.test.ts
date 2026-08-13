import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
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
