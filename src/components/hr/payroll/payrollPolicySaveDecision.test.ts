import { describe, expect, it } from "vitest";
import { canRecalculateAfterPolicySave } from "./payrollPolicySaveDecision";

describe("canRecalculateAfterPolicySave", () => {
  it("allows a missing or draft run", () => {
    expect(canRecalculateAfterPolicySave(undefined)).toBe(true);
    expect(canRecalculateAfterPolicySave("draft")).toBe(true);
  });

  it.each(["review", "closed", "paid"])("blocks a %s run", (status) => {
    expect(canRecalculateAfterPolicySave(status)).toBe(false);
  });
});
