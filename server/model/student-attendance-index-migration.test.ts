import { describe, expect, it, vi } from "vitest";
import { dropLegacyStudentAttendanceUniqueIndex } from "./student-attendance-index-migration";

describe("student attendance index migration", () => {
  it("drops the obsolete unique index", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = { indexes: vi.fn().mockResolvedValue([{ name: "student_batch_date_unique", key: { studentId: 1, batchId: 1, date: 1 }, unique: true }]), dropIndex };
    await expect(dropLegacyStudentAttendanceUniqueIndex(collection)).resolves.toBe(true);
    expect(dropIndex).toHaveBeenCalledWith("student_batch_date_unique");
  });
  it("is safe when absent", async () => {
    const collection = { indexes: vi.fn().mockResolvedValue([]), dropIndex: vi.fn() };
    await expect(dropLegacyStudentAttendanceUniqueIndex(collection)).resolves.toBe(false);
  });
});
