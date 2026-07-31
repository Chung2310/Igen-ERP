import { describe, expect, it } from "vitest";
import { allocatePayrollPayment, derivePayrollPaymentStatus } from "./payroll-payment-allocation.service";

describe("payroll payment allocation", () => {
  it("allocates payment without exceeding line net pay", () => {
    expect(allocatePayrollPayment([
      { employeeId: "e1", netPay: 10000000, confirmedPaid: 2000000 },
      { employeeId: "e2", netPay: 5000000, confirmedPaid: 0 },
    ], 10000000)).toEqual([
      { employeeId: "e1", amount: 8000000 },
      { employeeId: "e2", amount: 2000000 },
    ]);
  });

  it("derives payment status from confirmed amount", () => {
    expect(derivePayrollPaymentStatus(100, 0)).toBe("unpaid");
    expect(derivePayrollPaymentStatus(100, 50)).toBe("partially_paid");
    expect(derivePayrollPaymentStatus(100, 100)).toBe("paid");
    expect(() => allocatePayrollPayment([{ employeeId: "e1", netPay: 10, confirmedPaid: 0 }], 11)).toThrow("exceeds");
  });
});
