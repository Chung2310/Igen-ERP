import { describe, expect, it } from "vitest";
import { assertPayrollTransition } from "./payroll-run-state.service";

describe("assertPayrollTransition", () => {
  it("allows the operational happy path", () => {
    expect(() => assertPayrollTransition("draft", "attendance_locked")).not.toThrow();
    expect(() => assertPayrollTransition("attendance_locked", "calculated")).not.toThrow();
  });

  it("never reopens a closed run", () => {
    expect(() => assertPayrollTransition("closed", "calculated")).toThrow(/PAYROLL_INVALID_TRANSITION/);
  });
});
