import { describe, expect, it } from "vitest";
import { transitionPayrollPayment } from "./payroll-payment-lifecycle.service";

describe("transitionPayrollPayment", () => {
  it("allows confirm, cancel, and reverse only in valid states", () => {
    expect(transitionPayrollPayment({ status: "draft" }, "confirmed")).toEqual({ status: "confirmed" });
    expect(transitionPayrollPayment({ status: "draft" }, "cancelled")).toEqual({ status: "cancelled" });
    expect(transitionPayrollPayment({ status: "confirmed" }, "reversed")).toEqual({ status: "reversed" });
    expect(() => transitionPayrollPayment({ status: "draft" }, "reversed")).toThrow("Invalid payment transition");
    expect(() => transitionPayrollPayment({ status: "confirmed" }, "confirmed")).toThrow("Invalid payment transition");
  });
});
