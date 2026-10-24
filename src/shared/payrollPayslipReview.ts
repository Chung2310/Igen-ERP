export type PayslipReviewRequest = {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  periodKey: string;
  revisionChecksum: string;
  message: string;
  status: "open" | "resolved";
  response?: string;
  createdAt?: string;
  resolvedAt?: string;
};
