import { Document } from "mongoose";

export interface IProject extends Document {
  name: string;
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
}
