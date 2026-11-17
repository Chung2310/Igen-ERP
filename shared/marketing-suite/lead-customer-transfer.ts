// Keep the transfer history readable for Leads converted before the rollback.
export type LeadCustomerDestination = "customer" | "students" | "healthcare" | "retail";

export const leadCustomerDestinationLabels: Record<LeadCustomerDestination, string> = {
  customer: "Khách hàng",
  students: "Đào tạo · Học viên",
  healthcare: "Y tế · Bệnh nhân",
  retail: "Bán lẻ",
};

export const leadCustomerDestinations = Object.keys(leadCustomerDestinationLabels) as LeadCustomerDestination[];

export type LeadCustomerTransfer<TDate = string> = {
  destination: LeadCustomerDestination;
  branchId?: string;
  targetRecordId?: string;
  completedAt?: TDate;
};

export function getCompletedLeadModule(transfer?: LeadCustomerTransfer<string | Date>) {
  if (!transfer?.completedAt || !transfer.targetRecordId) return undefined;
  return transfer.destination === "students" || transfer.destination === "healthcare" ? transfer.destination : undefined;
}
