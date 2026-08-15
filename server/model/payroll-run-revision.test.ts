import { describe, expect, it } from "vitest";
import { PayrollRunModel } from "./payroll-run.model";

describe("PayrollRun revision linkage", () => {
  it("supports an optional active calculation revision for legacy runs", () => {
    const path = PayrollRunModel.schema.path("activeRevisionId");
    expect(path).toBeDefined();
    expect(path.options.required).not.toBe(true);
  });

  it("persists the pinned effective payroll snapshot separately from its source revision", () => {
    const path = PayrollRunModel.schema.path("effectiveSnapshot");

    expect(path).toBeDefined();
    expect(path.instance).toBe("Mixed");
    expect(PayrollRunModel.schema.path("activeRevisionChecksum")).toBeDefined();
  });

  it("persists immutable payment instructions on legacy payroll lines", () => {
    const path = PayrollRunModel.schema.path("lines.0.payment");

    expect(path).toBeDefined();
    expect(path.instance).toBe("Mixed");
  });

  it("preserves empty objects inside an effective snapshot", () => {
    const snapshotLines = [{
      employeeId: "employee-a",
      overrideValues: {},
      effectiveValues: { customValues: {} },
      provenance: { customValues: {} },
    }];
    const run = new PayrollRunModel({
      companyCode: "ACME",
      branchId: "branch-a",
      periodKey: "2026-08",
      type: "regular",
      status: "review",
      createdBy: "manager-a",
      effectiveSnapshot: {
        sourceRevisionChecksum: "source-checksum",
        checksum: "effective-checksum",
        lines: snapshotLines,
        pinnedAt: new Date("2026-08-15T00:00:00.000Z"),
      },
    });

    expect(run.toObject().effectiveSnapshot.lines).toEqual(snapshotLines);
  });
});
