import { describe, expect, it } from "vitest";
import { createQrSessionSchema } from "./worker-qr-attendance.validation";

describe("worker QR session validation", () => {
  it("rejects impossible calendar dates and accepts valid leap days", () => {
    expect(createQrSessionSchema.validate({
      projectId: "507f1f77bcf86cd799439011",
      date: "2026-02-31",
    }).error).toBeDefined();
    expect(createQrSessionSchema.validate({
      projectId: "507f1f77bcf86cd799439011",
      date: "2024-02-29",
    }).error).toBeUndefined();
  });
});
