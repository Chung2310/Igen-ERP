import { describe, expect, it } from "vitest";
import { attendanceRecordsQuerySchema, timekeepingRouter } from "./timekeeping.router";

describe("timekeeping multipart routes", () => {
  it.each(["/check-in", "/check-out"])("wires upload and face gate for %s", (path) => {
    const layer: any = (timekeepingRouter as any).stack.find((item: any) => item.route?.path === path);
    expect(layer).toBeDefined();
    const names = layer.route.stack.map((item: any) => item.handle.name);
    expect(names).toContain("multerMiddleware");
    expect(names).toContain("attendanceFaceGate");
  });

  it("accepts assistant context query fields for the daily report without adding them to the workflow inputs", () => {
    expect(attendanceRecordsQuerySchema.query.validate({
      date: "2026-11-02",
      companyCode: "ACME",
      branchId: "branch-a",
    }).error).toBeUndefined();
  });
});
