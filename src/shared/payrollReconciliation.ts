export const PAYROLL_RECONCILIATION_FIELDS = [
  { key: "workedMinutes", label: "Giờ công", unit: "minutes" },
  { key: "baseSalary", label: "Lương cơ bản", unit: "money" },
  { key: "adjustedBase", label: "Lương theo công", unit: "money" },
  { key: "overtime", label: "Tăng ca", unit: "money" },
  { key: "commission", label: "Hoa hồng", unit: "money" },
  { key: "bonusTotal", label: "Thưởng", unit: "money" },
  { key: "hiddenIncome", label: "Phụ cấp / thu nhập khác", unit: "money" },
  { key: "penaltyTotal", label: "Phạt", unit: "money" },
  { key: "socialInsurance", label: "BHXH", unit: "money" },
  { key: "healthInsurance", label: "BHYT", unit: "money" },
  { key: "unemploymentInsurance", label: "BHTN", unit: "money" },
  { key: "personalIncomeTax", label: "Thuế TNCN", unit: "money" },
  { key: "advances", label: "Tạm ứng", unit: "money" },
  { key: "otherDeductions", label: "Khấu trừ khác", unit: "money" },
  { key: "net", label: "Thực nhận", unit: "money" },
] as const;
export type PayrollReconciliationField = typeof PAYROLL_RECONCILIATION_FIELDS[number]["key"];
export type PayrollReconciliationSnapshot = {
  checksum: string;
  values: Record<PayrollReconciliationField, number>;
  publishedAt: string;
  publishedBy: string;
};
export type PayrollReconciliationMessage = {
  id: string; authorId: string; authorName: string; role: "employee" | "staff";
  body: string; at: string; action: "question" | "reply" | "resolve";
};
export type PayrollReconciliationIssue = {
  id: string; field: PayrollReconciliationField; status: "open" | "resolved";
  snapshotChecksum: string; messages: PayrollReconciliationMessage[];
};
export type PayrollReconciliation = {
  runId: string; employeeId: string; employeeName: string; periodKey: string; version: number;
  snapshot: PayrollReconciliationSnapshot;
  publications: PayrollReconciliationSnapshot[];
  issues: PayrollReconciliationIssue[];
  confirmedChecksum?: string;
  confirmedAt?: string;
  confirmations: Array<{ checksum: string; at: string; actorId: string }>;
  stale?: boolean; runStatus?: string;
};
