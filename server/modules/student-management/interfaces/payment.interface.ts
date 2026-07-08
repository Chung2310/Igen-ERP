import { Document } from "mongoose";

export interface IPayment extends Document {
  studentId: string;
  studentName: string;
  amount: number;
  date: string;
  note?: string;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
