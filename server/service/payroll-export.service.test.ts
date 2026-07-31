import { describe, expect, it } from "vitest";
import { buildPayrollWorkbook } from "./payroll-export.service";

describe("payroll workbook exports", () => {
  it.each([
    ["detailed", "Bảng lương", ["Mã nhân viên", "Tên nhân viên", "Tổng thu nhập"]],
    ["insurance", "Bảo hiểm", ["Mã nhân viên", "BHXH", "BHYT"]],
    ["pit", "Thuế TNCN", ["Mã nhân viên", "Thu nhập chịu thuế", "Thuế TNCN"]],
    ["bank_transfer", "Chuyển khoản ngân hàng", ["Mã nhân viên", "Tài khoản ngân hàng", "Số tiền"]],
  ] as const)("creates the %s sheet with stable columns", (type, sheet, columns) => {
    const workbook = buildPayrollWorkbook(type, [{ employeeId: "e1", employeeName: "A", sourceIds: [], effectiveSegments: [], formulaVersion: "vietnam-payroll-1", warnings: [], calculation: { gross: 1234567, net: 1200000 }, vietnam: { socialInsurance: 100, healthInsurance: 50, taxableIncome: 500, personalIncomeTax: 40, bankAccount: "123" } }]);
    expect(workbook.SheetNames).toContain(sheet);
    expect(workbook.Sheets[sheet]["A1"].v).toBe(columns[0]);
    expect(workbook.Sheets[sheet]["B1"].v).toBe(columns[1]);
    expect(workbook.Sheets[sheet]["C1"].v).toBe(columns[2]);
  });
});
