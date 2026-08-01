import { describe, expect, it } from "vitest";
import { PayrollRunModel } from "./payroll-run.model";

describe("PayrollRun revision linkage", () => {
  it("supports an optional active calculation revision for legacy runs", () => {
    const path = PayrollRunModel.schema.path("activeRevisionId");
    expect(path).toBeDefined();
    expect(path.options.required).not.toBe(true);
  });
});
