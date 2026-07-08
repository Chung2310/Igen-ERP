import { Document } from "mongoose";

export interface IPayout {
  id: string;
  amount: number;
  date: string;
  method: "Tiền mặt" | "Chuyển khoản";
  note?: string;
}

export interface IPartner extends Document {
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
