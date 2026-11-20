export interface WarehouseRecord {
  _id: string;
  companyCode: string;
  branchId?: string;
  code: string;
  name: string;
  location?: string;
  managerName?: string;
  managerPhone?: string;
  description?: string;
  isActive: boolean;
  supplyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseInput {
  branchId?: string;
  code: string;
  name: string;
  location?: string;
  managerName?: string;
  managerPhone?: string;
  description?: string;
  isActive?: boolean;
}
