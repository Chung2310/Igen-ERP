import assert from "node:assert/strict";
import { it } from "vitest";
import { upsertAttendanceRecord } from "./attendance-record.util";

it("changes one learner and preserves other learners and the session note", () => {
  const result = upsertAttendanceRecord([
    { date: "2026-11-01", note: "Kiểm tra giữa kỳ", records: [
      { studentId: "student-a", status: "present" },
      { studentId: "student-b", status: "absent" },
    ] },
    { date: "2026-10-31", note: "Buổi trước", records: [{ studentId: "student-c", status: "late" }] },
  ], "2026-11-01", "student-a", "excused");

  assert.deepEqual(result[0], {
    date: "2026-11-01", note: "Kiểm tra giữa kỳ", records: [
      { studentId: "student-a", status: "excused" },
      { studentId: "student-b", status: "absent" },
    ],
  });
  assert.deepEqual(result[1], { date: "2026-10-31", note: "Buổi trước", records: [{ studentId: "student-c", status: "late" }] });
});

it("adds a learner record without replacing an existing session", () => {
  const result = upsertAttendanceRecord([
    { date: "2026-11-01", note: "Ghi chú", records: [{ studentId: "student-a", status: "present" }] },
  ], "2026-11-01", "student-b", "late");

  assert.deepEqual(result[0].records, [
    { studentId: "student-a", status: "present" },
    { studentId: "student-b", status: "late" },
  ]);
  assert.equal(result[0].note, "Ghi chú");
});

it("creates a dated session when attendance has not been saved yet", () => {
  assert.deepEqual(upsertAttendanceRecord([], "2026-11-01", "student-a", "present"), [
    { date: "2026-11-01", note: "", records: [{ studentId: "student-a", status: "present" }] },
  ]);
});
