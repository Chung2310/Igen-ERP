import XLSX from "xlsx";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";

export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";

const number = (line: PayrollLineSnapshot, key: string) => Number(line.calculation[key] ?? line.vietnam?.[key] ?? 0);
const vietnam = (line: PayrollLineSnapshot, key: string) => line.vietnam?.[key] ?? "";

export function buildPayrollWorkbook(type: PayrollExportType, lines: PayrollLineSnapshot[]): XLSX.WorkBook {
  const rows = type === "detailed"
    ? lines.map((line) => ({ "Employee ID": line.employeeId, "Employee Name": line.employeeName ?? "", "Gross Pay": number(line, "gross"), "Deductions": number(line, "deductions"), "Net Pay": number(line, "net") || number(line, "netPay") }))
    : type === "insurance"
      ? lines.map((line) => ({ "Employee ID": line.employeeId, "Social Insurance": vietnam(line, "socialInsurance"), "Health Insurance": vietnam(line, "healthInsurance"), "Unemployment Insurance": vietnam(line, "unemploymentInsurance") }))
      : type === "pit"
        ? lines.map((line) => ({ "Employee ID": line.employeeId, "Taxable Income": vietnam(line, "taxableIncome"), "Personal Income Tax": vietnam(line, "personalIncomeTax") }))
        : lines.map((line) => ({ "Employee ID": line.employeeId, "Bank Account": vietnam(line, "bankAccount"), Amount: number(line, "net") || number(line, "netPay") }));
  const workbook = XLSX.utils.book_new();
  const sheetName = { detailed: "Payroll", insurance: "Insurance", pit: "PIT", bank_transfer: "Bank Transfer" }[type];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
