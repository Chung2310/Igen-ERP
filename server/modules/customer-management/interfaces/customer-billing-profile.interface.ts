export type BillingProfileStatus = "active" | "inactive";
export interface ICustomerBillingProfile { companyCode: string; customerId: string; legalName: string; taxId: string; address: string; invoiceEmail: string; contactName?: string; isDefault: boolean; status: BillingProfileStatus; createdBy: string; createdByName: string; version: number; createdAt?: Date; updatedAt?: Date }
export type BillingProfileInput = Partial<Pick<ICustomerBillingProfile, "legalName" | "taxId" | "address" | "invoiceEmail" | "contactName" | "isDefault">>;
export type BillingProfileSnapshot = Pick<ICustomerBillingProfile, "legalName" | "taxId" | "address" | "invoiceEmail" | "contactName">;
