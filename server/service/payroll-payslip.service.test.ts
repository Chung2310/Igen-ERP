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

  it("rejects draft runs", () => {
    expect(() => buildPayslip({ _id: "run-1", status: "calculated" }, { employeeId: "e1", calculation: { net: 1 }, formulaVersion: "legacy", warnings: [], sourceIds: [], effectiveSegments: [] }, [])).toThrow("closed");
  });
});
