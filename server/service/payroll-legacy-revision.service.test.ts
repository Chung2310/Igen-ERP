import { describe, expect, it } from "vitest";
import { buildLegacyRevision } from "./payroll-legacy-revision.service";

describe("buildLegacyRevision", () => {
  it("adapts legacy lines without changing their calculation values", () => {
    const revision = buildLegacyRevision({
      employeeId: "employee-1",
      employeeName: "Nguyen Van A",
      calculation: { adjustedBase: 25000000, net: 26000000 },
    });

    expect(revision.formulaVersion).toBe("legacy");
    expect(revision.calculation).toEqual({ adjustedBase: 25000000, net: 26000000 });
    expect(revision.sourceIds).toEqual([]);
  });
});
