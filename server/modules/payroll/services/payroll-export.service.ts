import XLSX from "xlsx";
import type { PayrollLineSnapshot } from "../interfaces/payroll-revision.interface";

export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";

const number = (value: unknown) => Number(value ?? 0);
const vietnamSnapshot = (line: PayrollLineSnapshot) => (line.vietnam ?? {}) as any;
const insuranceAmount = (line: PayrollLineSnapshot, code: string, legacyKey: string) => {
  const vietnam = vietnamSnapshot(line);
  const funds = Array.isArray(vietnam.insurance?.funds) ? vietnam.insurance.funds : [];
  return number(funds.find((fund: any) => fund.code === code)?.employeeAmount ?? vietnam[legacyKey]);
};

export function buildPayrollWorkbook(type: PayrollExportType, lines: PayrollLineSnapshot[]): XLSX.WorkBook {
  const rows = type === "detailed"
    ? lines.map((line) => {
        const vn = (line.vietnam || {}) as any;
        const funds = Array.isArray(vn.insurance?.funds) ? vn.insurance.funds : [];
        const fundAmount = (code: string) => Number(funds.find((fund: any) => fund.code === code)?.employeeAmount ?? 0);
        const socialInsurance = fundAmount("social");
        const healthInsurance = fundAmount("health");
        const unemploymentInsurance = fundAmount("unemployment");
        const personalIncomeTax = Number(vn.tax?.tax ?? 0);
        const otherDeductions = Number(vn.deductions?.other ?? 0);
        const advances = Number(vn.deductions?.advances ?? 0);
        return {
          "Mã nhân viên": line.employeeId,
          "Tên nhân viên": line.employeeName ?? "",
          "Lương cơ bản": Number(line.calculation?.monthlySalary ?? line.calculation?.baseSalary ?? 0),
          "Lương điều chỉnh": Number(line.calculation?.adjustedBase ?? 0),
          "Tăng ca": Number(line.calculation?.overtime ?? 0),
          "BHXH": socialInsurance,
          "BHYT": healthInsurance,
          "BHTN": unemploymentInsurance,
          "Thuế TNCN": personalIncomeTax,
          "Khấu trừ khác": otherDeductions,
          "Tạm ứng": advances,
          "Tổng khấu trừ": socialInsurance + healthInsurance + unemploymentInsurance + personalIncomeTax + otherDeductions + advances,
          "Thực nhận": Number(line.calculation?.net ?? vn.netPay ?? 0),
        };
      })
    : type === "insurance"
      ? lines.map((line) => ({
          "Mã nhân viên": line.employeeId,
          "BHXH": insuranceAmount(line, "social", "socialInsurance"),
          "BHYT": insuranceAmount(line, "health", "healthInsurance"),
          "BHTN": insuranceAmount(line, "unemployment", "unemploymentInsurance"),
        }))
      : type === "pit"
        ? lines.map((line) => {
            const vietnam = vietnamSnapshot(line);
            return {
              "Mã nhân viên": line.employeeId,
              "Thu nhập chịu thuế": number(vietnam.income?.taxableIncome ?? vietnam.taxableIncome),
              "Thuế TNCN": number(vietnam.tax?.tax ?? vietnam.personalIncomeTax),
            };
          })
        : lines.filter((line) => line.payment?.method !== "cash").map((line) => {
            const vietnam = vietnamSnapshot(line);
            return {
              "Mã nhân viên": line.employeeId,
              "Tài khoản ngân hàng": line.payment?.bankAccountNumber ?? vietnam.bankAccount ?? "",
              "Số tiền": number(line.calculation?.net ?? vietnam.netPay),
            };
          });
  const workbook = XLSX.utils.book_new();
  const sheetName = { detailed: "Bảng lương chi tiết", insurance: "Bảo hiểm", pit: "Thuế TNCN", bank_transfer: "Chuyển khoản ngân hàng" }[type];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
