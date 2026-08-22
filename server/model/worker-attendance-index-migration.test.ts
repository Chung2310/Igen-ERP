import { describe, expect, it, vi } from "vitest";
import { dropLegacyWorkerAttendanceIndexes } from "./worker-attendance-index-migration";

describe("worker attendance index migration", () => {
  it("drops indexes still keyed by the student schema", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = {
      indexes: vi.fn().mockResolvedValue([
        { name: "_id_", key: { _id: 1 } },
        { name: "studentId_1_batchId_1_date_1", key: { studentId: 1, batchId: 1, date: 1 }, unique: true },
        { name: "batchId_1_date_-1", key: { batchId: 1, date: -1 } },
        { name: "workerId_1_projectId_1_date_1", key: { workerId: 1, projectId: 1, date: 1 }, unique: true },
      ]),
      dropIndex,
    };
    await expect(dropLegacyWorkerAttendanceIndexes(collection)).resolves.toBe(2);
    expect(dropIndex).toHaveBeenCalledWith("studentId_1_batchId_1_date_1");
    expect(dropIndex).toHaveBeenCalledWith("batchId_1_date_-1");
    expect(dropIndex).not.toHaveBeenCalledWith("workerId_1_projectId_1_date_1");
  });

  it("is safe when the collection does not exist yet", async () => {
    const collection = { indexes: vi.fn().mockRejectedValue({ code: 26, codeName: "NamespaceNotFound" }), dropIndex: vi.fn() };
    await expect(dropLegacyWorkerAttendanceIndexes(collection)).resolves.toBe(0);
  });

  it("is safe when nothing legacy remains", async () => {
    const collection = { indexes: vi.fn().mockResolvedValue([{ name: "workerId_1_projectId_1_date_1", key: { workerId: 1, projectId: 1, date: 1 }, unique: true }]), dropIndex: vi.fn() };
    await expect(dropLegacyWorkerAttendanceIndexes(collection)).resolves.toBe(0);
  });
});
