export type PayslipPublicationStatus = "published" | "withdrawn";

export interface IPayslipPublication {
  companyCode: string;
  branchId: string;
  runId: string;
  employeeId: string;
  revisionChecksum: string;
  status: PayslipPublicationStatus;
  publishedBy?: string;
  publishedAt?: Date;
  withdrawnBy?: string;
  withdrawnAt?: Date;
}
