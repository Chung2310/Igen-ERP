import XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildPayrollWorkbook } from "./payroll-export.service";

const dataRows = (type: Parameters<typeof buildPayrollWorkbook>[0], line: any) => {
  const workbook = buildPayrollWorkbook(type, [line]);
  return XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
};

describe("payroll workbook exports", () => {
  it.each([
    ["detailed", "Bảng lương chi tiết", ["Mã nhân viên", "Tên nhân viên", "Lương cơ bản"]],
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

  it("reads insurance, PIT and bank-transfer values from the immutable nested snapshot", () => {
    const line = {
      employeeId: "e1",
      employeeName: "Employee One",
      sourceIds: [],
      effectiveSegments: [],
      formulaVersion: "vietnam-payroll-2",
      warnings: [],
      calculation: { net: 9_125_000 },
      vietnam: {
        insurance: {
          funds: [
            { code: "social", employeeAmount: 800_000 },
            { code: "health", employeeAmount: 150_000 },
            { code: "unemployment", employeeAmount: 100_000 },
          ],
        },
        income: { taxableIncome: 11_500_000 },
        tax: { tax: 275_000 },
      },
      payment: {
        method: "transfer",
        bankName: "Vietcombank",
        bankCode: "VCB",
        bankAccountNumber: "0123456789",
        bankAccountHolder: "EMPLOYEE ONE",
      },
    };

    expect(dataRows("insurance", line)[1]).toEqual(["e1", 800_000, 150_000, 100_000]);
    expect(dataRows("pit", line)[1]).toEqual(["e1", 11_500_000, 275_000]);
    expect(dataRows("bank_transfer", line)[1]).toEqual(["e1", "0123456789", 9_125_000]);
  });

  it("excludes cash payroll lines from bank transfers but keeps legacy unknown methods", () => {
    const workbook = buildPayrollWorkbook("bank_transfer", [{
      employeeId: "cash-employee",
      calculation: { net: 1_000 },
      sourceIds: [], effectiveSegments: [], formulaVersion: "legacy", warnings: [],
      payment: { method: "cash", bankAccountNumber: "should-not-export" },
    }, {
      employeeId: "transfer-employee",
      calculation: { net: 2_000 },
      sourceIds: [], effectiveSegments: [], formulaVersion: "legacy", warnings: [],
      payment: { method: "transfer", bankAccountNumber: "transfer-account" },
    }, {
      employeeId: "legacy-employee",
      calculation: { net: 3_000 },
      sourceIds: [], effectiveSegments: [], formulaVersion: "legacy", warnings: [],
      vietnam: { bankAccount: "legacy-account" },
    }]);
    const rows = XLSX.utils.sheet_to_json<any[]>(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1 },
    );

    expect(rows.slice(1)).toEqual([
      ["transfer-employee", "transfer-account", 2_000],
      ["legacy-employee", "legacy-account", 3_000],
    ]);
  });
});
