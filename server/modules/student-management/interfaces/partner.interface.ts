import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export interface IPayout {
  id: string;
  amount: number;
  date: string;
  method: "Tiền mặt" | "Chuyển khoản";
  note?: string;
}

export interface IPartner extends Document {
  customFields?: CustomFieldValues;
  name: string;
  phone: string;
  email?: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  isActive: boolean;
  ownerId: string;
  notes?: string;
  payoutHistory?: IPayout[];
  createdAt?: Date;
  updatedAt?: Date;
}
