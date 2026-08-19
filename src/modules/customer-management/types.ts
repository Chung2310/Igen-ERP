export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type CustomerGender = "male" | "female" | "other";

export interface Customer {
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
  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerInput = Pick<Customer, "name" | "phone"> & Partial<Pick<Customer, "type" | "email" | "dateOfBirth" | "gender" | "address" | "notes">>;
export type CustomerListQuery = {
  companyCode?: string;
  q?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  page?: number;
  limit?: number;
};
export type PaginatedCustomers = { items: Customer[]; total: number; page: number; limit: number };
export interface BillingProfile { _id: string; customerId: string; legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string; isDefault: boolean; status: CustomerStatus; version: number }
export type BillingProfileInput = Pick<BillingProfile, "legalName" | "taxId" | "address" | "invoiceEmail"> & Partial<Pick<BillingProfile, "contactName" | "isDefault">>;
