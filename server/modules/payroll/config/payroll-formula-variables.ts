import type { PayrollFormulaVariableKey } from "../interfaces/payroll-formula.interface";

export const PAYROLL_FORMULA_VARIABLES: Record<PayrollFormulaVariableKey, { label: string; unit: "VND" | "days" | "hours" | "minutes" | "months" }> = {
  monthlySalary: { label: "Lương tháng", unit: "VND" }, attendanceSalary: { label: "Lương theo công", unit: "VND" },
  standardWorkDays: { label: "Ngày công chuẩn", unit: "days" }, actualWorkDays: { label: "Ngày công thực tế", unit: "days" },
  standardWorkHours: { label: "Giờ công chuẩn", unit: "hours" }, actualWorkHours: { label: "Giờ công thực tế", unit: "hours" },
  shortageMinutes: { label: "Phút thiếu công", unit: "minutes" }, lateMinutes: { label: "Phút đi muộn", unit: "minutes" },
  earlyLeaveMinutes: { label: "Phút về sớm", unit: "minutes" }, paidLeaveDays: { label: "Ngày nghỉ có lương", unit: "days" },
  weekdayOvertimeHours: { label: "Giờ tăng ca ngày thường", unit: "hours" }, restDayOvertimeHours: { label: "Giờ tăng ca ngày nghỉ", unit: "hours" },
  holidayOvertimeHours: { label: "Giờ tăng ca ngày lễ", unit: "hours" }, tenureMonths: { label: "Thâm niên", unit: "months" },
};
export const isPayrollFormulaVariable = (value: string): value is PayrollFormulaVariableKey => value in PAYROLL_FORMULA_VARIABLES || /^custom\.[a-z][a-z0-9_]*$/.test(value);
