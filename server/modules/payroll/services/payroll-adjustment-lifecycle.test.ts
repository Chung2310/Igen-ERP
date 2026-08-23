import { describe, expect, it } from "vitest";
import { transitionPayrollAdjustment } from "./payroll-adjustment-lifecycle.service";

describe("transitionPayrollAdjustment", () => {
  it("allows review transitions and requires a revision to snapshot", () => {
    expect(transitionPayrollAdjustment({ status: "draft" }, "pending")).toEqual({ status: "pending" });
    expect(transitionPayrollAdjustment({ status: "pending" }, "approved")).toEqual({ status: "approved" });
    expect(transitionPayrollAdjustment({ status: "approved" }, "snapshotted", "revision-1")).toEqual({ status: "snapshotted", snapshotRevisionId: "revision-1" });
    expect(() => transitionPayrollAdjustment({ status: "draft" }, "approved")).toThrow("Invalid adjustment transition");
    expect(() => transitionPayrollAdjustment({ status: "approved" }, "snapshotted")).toThrow("snapshot revision");
  });
});

it('increments version when approving or rejecting', () => {
  expect(transitionPayrollAdjustment({ status: 'pending', version: 0 }, 'approved')).toEqual({ status: 'approved', version: 1 });
});


