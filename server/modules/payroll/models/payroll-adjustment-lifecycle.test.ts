import { describe, expect, it } from "vitest";
import { PayrollAdjustmentModel } from "./payroll-adjustment.model";

describe("PayrollAdjustment lifecycle", () => {
  it("supports draft, pending, approved, rejected, and snapshotted states", () => {
    const status = PayrollAdjustmentModel.schema.path("status").options.enum;
    expect(status).toEqual(["draft", "pending", "approved", "rejected", "snapshotted"]);
    expect(PayrollAdjustmentModel.schema.path("snapshotRevisionId")).toBeDefined();
    expect(PayrollAdjustmentModel.schema.path("version")).toBeDefined();
  });
});

