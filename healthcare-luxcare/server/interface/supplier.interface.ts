import type { Document } from "mongoose";

export interface ISupplier extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}
