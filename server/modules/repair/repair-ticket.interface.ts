import type { RepairStatus } from "./repair-state";
export interface RepairTicketDocument {
  ticketType?: "service" | "warranty";
  subjectType?: "product" | "equipment" | "service";
  intakeSource?: "external" | "company_sale";
  customerCode?: string;
  linkedSerialUnitId?: string;
  intakeRequestKey?: string;
  intakeRequestFingerprint?: string;
  warrantyEvidence?: { reference: string; endAt: Date; verifiedBy: string; verifiedAt: Date };
  partsVersion?: number;
}

export interface RepairCoverage { customer: { covered: boolean; endAt?: Date; daysLeft?: number }; supplier: { covered: boolean; endAt?: Date; daysLeft?: number; supplierId?: string; supplierName?: string }; costBearer: "supplier" | "shop" | "customer"; checkedAt: Date }
export interface RepairTicketDocument { companyCode: string; branchId: string; ticketCode: string; customerId: string; customerName: string; customerPhone: string; device: { productId?: string; serialNumber?: string; name: string; condition: string; accessories: string[]; imeiVerified: boolean; imei?: string; normalizedSerialNumber?: string; normalizedImei?: string }; coverage: RepairCoverage; supplierClaim?: { sentAt?: Date; supplierRef?: string; expectedReturnAt?: Date; returnedAt?: Date; outcome?: "repaired" | "replaced" | "rejected"; replacementSerialUnitId?: string; note?: string }; symptom: string; diagnosis?: string; status: RepairStatus; statusHistory: Array<{ from?: RepairStatus; to: RepairStatus; at: Date; by: string; byName: string; note?: string; customerNotified: boolean; technicianId?: string; technicianName?: string }>; laborFee: number; partCost: number; discountAmount: number; totalAmount: number; paidAmount: number; dueAmount: number; paymentStatus: "unpaid" | "partial" | "paid"; receivedAt: Date; promisedAt?: Date; completedAt?: Date; deliveredAt?: Date; createdBy: string; createdByName: string; createdAt?: Date; updatedAt?: Date }
export interface RepairTicketDocument { quotedAmount?: number; quotedAt?: Date; customerApprovedAt?: Date }
export interface RepairTicketDocument { feedbackToken?: string }
export interface RepairTicketDocument { normalizedCustomerPhone?: string; technicianId?: string; technicianName?: string; assignedAt?: Date; assignedBy?: string; partRevenue?: number }
export interface RepairTicketDocument { retailPartnerId?: string; retailPartnerSnapshot?: { partnerId: string; code: string; name: string } }
export interface RepairTicketDocument { paymentLedgerBaseline?: number }
