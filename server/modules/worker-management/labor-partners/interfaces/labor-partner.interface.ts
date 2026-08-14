import type { Document, Types } from "mongoose";

export interface ILaborPartner extends Document {
  companyCode: string;
  branchId?: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  taxCode?: string;
  representative?: string;
  address?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  defaultPolicyId?: Types.ObjectId | null;
  status: "active" | "inactive";
  note?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
