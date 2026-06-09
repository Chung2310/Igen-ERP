import { Document } from "mongoose";

export interface ICompany extends Document {
  code: string;
  name: string;
  createdAt: Date;
  ownerEmail: string;
}
