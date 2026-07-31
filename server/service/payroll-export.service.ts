import XLSX from "xlsx";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";

export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";

const number = (line: PayrollLineSnapshot, key: string) => Number(line.calculation[key] ?? line.vietnam?.[key] ?? 0);
const vietnam = (line: PayrollLineSnapshot, key: string) => line.vietnam?.[key] ?? "";

export function buildPayrollWorkbook(type: PayrollExportType, lines: PayrollLineSnapshot[]): XLSX.WorkBook {
  const rows = type === "detailed"
    ? lines.map((line) => ({ "Mã nhân viên": line.employeeId, "Tên nhân viên": line.employeeName ?? "", "Tổng thu nhập": number(line, "gross"), "Các khoản khấu trừ": number(line, "deductions"), "Thực nhận": number(line, "net") || number(line, "netPay") }))
    : type === "insurance"
      ? lines.map((line) => ({ "Mã nhân viên": line.employeeId, "BHXH": vietnam(line, "socialInsurance"), "BHYT": vietnam(line, "healthInsurance"), "BHTN": vietnam(line, "unemploymentInsurance") }))
      : type === "pit"
        ? lines.map((line) => ({ "Mã nhân viên": line.employeeId, "Thu nhập chịu thuế": vietnam(line, "taxableIncome"), "Thuế TNCN": vietnam(line, "personalIncomeTax") }))
        : lines.map((line) => ({ "Mã nhân viên": line.employeeId, "Tài khoản ngân hàng": vietnam(line, "bankAccount"), "Số tiền": number(line, "net") || number(line, "netPay") }));
  const workbook = XLSX.utils.book_new();
  const sheetName = { detailed: "Bảng lương", insurance: "Bảo hiểm", pit: "Thuế TNCN", bank_transfer: "Chuyển khoản ngân hàng" }[type];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
