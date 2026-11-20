export interface SupplierRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  notes?: string;
  isActive: boolean;
  supplyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierInput {
  code: string;
  name: string;
  shortName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  notes?: string;
  isActive?: boolean;
}
