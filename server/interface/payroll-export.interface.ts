export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";
export type PayrollExportStatus = "queued" | "completed" | "failed";
export interface IPayrollExportJob {
  companyCode: string; branchId: string; runId: string; type: PayrollExportType;
  revisionChecksum: string; status: PayrollExportStatus; createdBy: string;
  filters?: Record<string, unknown>; output?: { contentType: string; size: number; checksum: string };
  error?: string; completedAt?: Date;
}
