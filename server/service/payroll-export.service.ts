import XLSX from "xlsx";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";

export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";

const number = (line: PayrollLineSnapshot, key: string) => Number(line.calculation[key] ?? line.vietnam?.[key] ?? 0);
const vietnam = (line: PayrollLineSnapshot, key: string) => line.vietnam?.[key] ?? "";

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
      ? lines.map((line) => ({ "Mã nhân viên": line.employeeId, "BHXH": vietnam(line, "socialInsurance"), "BHYT": vietnam(line, "healthInsurance"), "BHTN": vietnam(line, "unemploymentInsurance") }))
      : type === "pit"
        ? lines.map((line) => ({ "Mã nhân viên": line.employeeId, "Thu nhập chịu thuế": vietnam(line, "taxableIncome"), "Thuế TNCN": vietnam(line, "personalIncomeTax") }))
        : lines.map((line) => ({ "Mã nhân viên": line.employeeId, "Tài khoản ngân hàng": vietnam(line, "bankAccount"), "Số tiền": number(line, "net") || number(line, "netPay") }));
  const workbook = XLSX.utils.book_new();
  const sheetName = { detailed: "Bảng lương chi tiết", insurance: "Bảo hiểm", pit: "Thuế TNCN", bank_transfer: "Chuyển khoản ngân hàng" }[type];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
