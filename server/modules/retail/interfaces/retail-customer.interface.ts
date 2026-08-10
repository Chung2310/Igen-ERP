export interface IRetailCustomer {
  customerCode: string;
  companyCode: string;
  originBranchId: string;
  name: string;
  phone?: string;
  normalizedPhone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt?: Date;
  updatedAt?: Date;
}
