import { describe, expect, it, vi } from "vitest";
import { dropLegacyUniqueIndex } from "./student-attendance-index-migration";

describe("student attendance attempt index migration", () => {
  it("drops the obsolete unique index", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = { indexes: vi.fn().mockResolvedValue([{ name: "student_batch_date_unique", key: { studentId: 1, batchId: 1, date: 1 }, unique: true }]), dropIndex };
    await expect(dropLegacyUniqueIndex(collection)).toBeDefined();
    expect(dropIndex).toHaveBeenCalledWith("student_batch_date_unique");
  });
  it("is safe when absent", async () => {
    const collection = { indexes: vi.fn().mockResolvedValue([]), dropIndex: vi.fn() };
    await expect(dropLegacyUniqueIndex(collection)).resolves.toBe(false);
  });
});
