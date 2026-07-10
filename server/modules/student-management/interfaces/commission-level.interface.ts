import { Document } from "mongoose";

export interface ICommissionLevel extends Document {
  name: string;
  minTuition: number;
  commissionRate: number;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
