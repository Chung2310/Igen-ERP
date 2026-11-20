export type PayrollPayslipView = {
  runId: string;
  periodKey?: string;
  employeeId: string;
  employeeName?: string;
  calculation: Record<string, number>;
  netPay: number;
  paidAmount: number;
  balance: number;
  checksum?: string;
  formulaVersion: string;
  warnings: string[];
  kpi?: {
    periodKey: string;
    sourceStatus: string;
    systemPercent: number;
    appliedPercent: number;
    netBeforeKpi: number;
    adjustment: number;
  };
  vietnam?: Record<string, unknown>;
};
