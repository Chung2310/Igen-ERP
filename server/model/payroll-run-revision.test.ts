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
});
