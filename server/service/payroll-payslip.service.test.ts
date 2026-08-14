import { describe, expect, it } from "vitest";
import { buildPayslip } from "./payroll-payslip.service";

describe("payroll payslip view", () => {
  it("renders only a closed run snapshot", () => {
    const payslip = buildPayslip(
      { _id: "run-1", status: "closed", periodKey: "2026-07", activeRevisionChecksum: "abc" },
      { employeeId: "employee-1", employeeName: "Nguyen Van A", calculation: { gross: 20000000, deductions: 2000000, net: 18000000 }, formulaVersion: "vietnam-payroll-1", warnings: [], sourceIds: [], effectiveSegments: [] },
      [{ employeeId: "employee-1", amount: 10000000, status: "confirmed" }],
    );

    expect(payslip).toMatchObject({ runId: "run-1", employeeId: "employee-1", netPay: 18000000, paidAmount: 10000000, checksum: "abc" });
    expect(payslip.calculation).toEqual({ gross: 20000000, deductions: 2000000, net: 18000000 });
  });

  it("sums confirmed persisted payment allocations and ignores cancelled or reversed payments", () => {
    const payslip = buildPayslip(
      { _id: "run-1", status: "paid", periodKey: "2026-07", activeRevisionChecksum: "abc" },
      { employeeId: "employee-1", calculation: { net: 18000000 }, formulaVersion: "vietnam-payroll-1", warnings: [], sourceIds: [], effectiveSegments: [] },
      [
        { status: "confirmed", lines: [{ employeeId: "employee-1", amount: 7000000 }, { employeeId: "employee-2", amount: 3000000 }] },
        { status: "confirmed", lines: [{ employeeId: "employee-1", amount: 2000000 }] },
        { status: "cancelled", lines: [{ employeeId: "employee-1", amount: 4000000 }] },
        { status: "reversed", lines: [{ employeeId: "employee-1", amount: 5000000 }] },
      ],
    );

    expect(payslip).toMatchObject({ paidAmount: 9000000, balance: 9000000 });
  });

  it("rejects draft runs", () => {
    expect(() => buildPayslip({ _id: "run-1", status: "calculated" }, { employeeId: "e1", calculation: { net: 1 }, formulaVersion: "legacy", warnings: [], sourceIds: [], effectiveSegments: [] }, [])).toThrow("closed");
  });
});
