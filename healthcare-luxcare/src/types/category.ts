export interface CategoryRecord {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  supplyCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryInput {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}
