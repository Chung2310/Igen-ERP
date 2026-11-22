import { describe, expect, it } from "vitest";
import { listAttendanceQuerySchema } from "./worker-attendance.validation";

const projectId = "507f1f77bcf86cd799439011";

describe("worker attendance list query", () => {
  it("accepts a day or a complete date range", () => {
    expect(listAttendanceQuerySchema.validate({ projectId, date: "2026-08-04" }).error).toBeUndefined();
    expect(listAttendanceQuerySchema.validate({ projectId, from: "2026-08-01", to: "2026-08-04" }).error).toBeUndefined();
    expect(listAttendanceQuerySchema.validate({ projectId }).error).toBeUndefined();
  });

  it("rejects partial ranges and mixed day/range filters", () => {
    expect(listAttendanceQuerySchema.validate({ projectId, from: "2026-08-01" }).error).toBeDefined();
    expect(listAttendanceQuerySchema.validate({ projectId, to: "2026-08-04" }).error).toBeDefined();
    expect(listAttendanceQuerySchema.validate({ projectId, date: "2026-08-04", from: "2026-08-01", to: "2026-08-04" }).error).toBeDefined();
  });

  it("rejects dates that match the format but do not exist on the calendar", () => {
    expect(listAttendanceQuerySchema.validate({ projectId, date: "2026-02-31" }).error).toBeDefined();
    expect(listAttendanceQuerySchema.validate({ projectId, from: "2026-02-29", to: "2026-03-01" }).error).toBeDefined();
    expect(listAttendanceQuerySchema.validate({ projectId, from: "2024-02-29", to: "2024-03-01" }).error).toBeUndefined();
  });
});
