import { describe, expect, it } from "vitest";
import { canMarkPayrollPaid } from "./payrollPaidAction";

describe("canMarkPayrollPaid", () => {
  it("allows a manager to mark a closed payroll run as paid", () => {
    expect(canMarkPayrollPaid(true, "closed")).toBe(true);
  });

  it.each(["draft", "review", "paid", undefined])("hides the action for status %s", (status) => {
    expect(canMarkPayrollPaid(true, status)).toBe(false);
  });

  it("hides the action from users without payroll management permission", () => {
    expect(canMarkPayrollPaid(false, "closed")).toBe(false);
  });
});
