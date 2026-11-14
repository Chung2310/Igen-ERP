export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type CustomerKind = "individual" | "business";
export type CustomerGender = "male" | "female" | "other";

export interface Customer {
  customerKind?: CustomerKind;
  contactName?: string;
  _id: string;
  companyCode: string;
  customerCode: string;
  type: CustomerType;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: CustomerGender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: "manual" | "pos" | "import";
  tier?: { code: string; name: string; minGrossProfit?: number; minSpend?: number };
  tierGrossProfit?: number;
  tierTotalSales?: number;
  tierUpdatedAt?: string;
  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerInput = Pick<Customer, "name" | "phone"> & Partial<Pick<Customer, "type" | "customerKind" | "contactName" | "email" | "dateOfBirth" | "gender" | "address" | "notes" | "source">> & { allowSharedPhone?: boolean };
export type CustomerListQuery = {
  companyCode?: string;
  q?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  customerKind?: CustomerKind | "unclassified";
  page?: number;
  limit?: number;
};
export type PaginatedCustomers = { items: Customer[]; total: number; page: number; limit: number };
export interface BillingProfile { _id: string; customerId: string; legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string; isDefault: boolean; status: CustomerStatus; version: number }
export type BillingProfileInput = Pick<BillingProfile, "legalName" | "taxId" | "address" | "invoiceEmail"> & Partial<Pick<BillingProfile, "contactName" | "isDefault">>;

export interface CustomerPurchaseHistorySummary {
  orderCount: number;
  totalPurchased: number;
  totalPaid: number;
  currentDebt: number;
  lastPurchaseAt?: string;
}

export interface CustomerPurchaseHistoryItem {
  _id: string;
  orderCode?: string;
  status?: string;
  businessDate?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  itemCount: number;
  salespersonName?: string;
}

export interface CustomerPurchaseHistoryDevice {
  _id: string;
  productName: string;
  sku?: string;
  internalBarcode?: string;
  serialNumber?: string;
  soldAt?: string;
  orderCode?: string;
  warrantyStartAt?: string;
  warrantyEndAt?: string;
}

export interface CustomerPurchaseHistory {
  summary: CustomerPurchaseHistorySummary;
  items: CustomerPurchaseHistoryItem[];
  devices: CustomerPurchaseHistoryDevice[];
}

export type CustomerPurchaseHistoryScope = { companyCode: string; branchId: string };
export type CustomerLeadNeeds = { id: string; needs?: import("../../../shared/marketing-suite/lead-intake").LeadNeed[]; intakeFields?: import("../../../shared/marketing-suite/lead-intake").LeadIntakeField[]; productOfChoice?: string; sourcePlatform?: string };
export type CustomerModule = "students" | "healthcare";
export type CustomerModuleRecord = { id: string; name: string; code?: string; status?: string[]; fee?: string; paidAmount?: number; phone?: string; dateOfBirth?: string; birthYear?: string };
export type CustomerModuleLinks = { modules: CustomerModule[]; manageable: CustomerModule[]; links: Array<CustomerModuleRecord & { module: CustomerModule; canUnlink: boolean }> };
export type CustomerSourceCandidate = Pick<Customer, "name" | "customerCode" | "phone" | "dateOfBirth" | "customerKind" | "status"> & { customerId: string; samePhone: boolean };
export type CustomerSourceCandidates = { items: CustomerSourceCandidate[]; truncated: boolean };
export type CustomerSourceLinkInput = { customerId: string } | { create: true; phone: string; allowSharedPhone: boolean };
export type CustomerSourceRef = { module: CustomerModule; sourceId: string };
export type CustomerSourceBatchRow = CustomerSourceRef & {
  status: "ready" | "shared-customer-phone" | "shared-batch-phone" | "missing-phone" | "linked" | "unavailable" | "transferred" | "failed";
  message?: string;
};
