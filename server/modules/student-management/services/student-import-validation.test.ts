import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { StudentService } from "./student.service";

afterEach(() => vi.restoreAllMocks());

it("previews duplicate CCCD values in the file and against existing students", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({
    select: async () => [{ phone: "0900000000", email: "used@example.com", idCard: "001002003004" }],
  });

  const result = await StudentService.previewBulkStudents("owner-a", [
    { sourceRow: 2, fullName: "Existing", phone: "0910000001", idCard: "001 002 003 004" },
    { sourceRow: 3, fullName: "First", phone: "0910000002", idCard: "005006007008" },
    { sourceRow: 4, fullName: "Duplicate", phone: "0910000003", idCard: "005 006 007 008" },
  ]);

  assert.deepEqual(result.errors.map(({ index, row, reason }) => ({ index, row, reason })), [
    { index: 0, row: 2, reason: "CCCD/CMND đã tồn tại trong trung tâm hiện tại." },
    { index: 2, row: 4, reason: "CCCD/CMND bị trùng lặp trong file import." },
  ]);
});

it("bulk import skips a repeated CCCD with the original Excel row number", async () => {
  vi.spyOn(Student as any, "find").mockReturnValue({ select: async () => [] });
  vi.spyOn(Student as any, "insertMany").mockImplementation(async (students: any[]) => students.map((student, index) => ({
    ...student,
    _id: { toString: () => `student-${index}` },
  })));

  const result = await StudentService.bulkCreateStudents("creator-a", "owner-a", [
    { sourceRow: 2, fullName: "First", phone: "0910000001", idCard: "005006007008", fee: "0" },
    { sourceRow: 3, fullName: "Duplicate", phone: "0910000002", idCard: "005 006 007 008", fee: "0" },
  ]);

  assert.equal(result.importedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.errors, [{
    row: 3,
    name: "Duplicate",
    phone: "0910000002",
    reason: "CCCD/CMND bị trùng lặp trong file import.",
  }]);
});
