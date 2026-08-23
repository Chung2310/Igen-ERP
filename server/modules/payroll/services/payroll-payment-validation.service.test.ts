import { describe, expect, it } from "vitest";
import { validatePayrollPaymentRequest } from "./payroll-payment-validation.service";

describe("validatePayrollPaymentRequest", () => {
  it("rejects an allocation above active net pay", () => {
    expect(() => validatePayrollPaymentRequest({ amount: 110, lines: [{ employeeId: "e1", amount: 110 }] }, [{ employeeId: "e1", netPay: 100 }])).toThrow("exceeds remaining payroll balance");
  });
  it("accepts and normalizes a valid allocation", () => {
    expect(validatePayrollPaymentRequest({ amount: 60, lines: [{ employeeId: "e1", amount: 60 }] }, [{ employeeId: "e1", netPay: 100 }])).toEqual([{ employeeId: "e1", amount: 60 }]);
  });
});
