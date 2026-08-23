import { describe, expect, it } from "vitest";
import { assertPayrollTransition } from "./payroll-run-state.service";

describe("assertPayrollTransition", () => {
  it("allows the canonical forward path", () => {
    expect(() => assertPayrollTransition("draft", "review")).not.toThrow();
    expect(() => assertPayrollTransition("review", "closed")).not.toThrow();
    expect(() => assertPayrollTransition("closed", "paid")).not.toThrow();
  });

  it("reopens review and closed runs to draft", () => {
    expect(() => assertPayrollTransition("review", "draft")).not.toThrow();
    expect(() => assertPayrollTransition("closed", "draft")).not.toThrow();
  });

  it("never reopens a paid run", () => {
    expect(() => assertPayrollTransition("paid", "draft")).toThrow(/PAYROLL_INVALID_TRANSITION/);
  });
});
