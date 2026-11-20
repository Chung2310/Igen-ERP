import { Document, Types } from "mongoose";

export interface IUserBlock extends Document {
  userId: Types.ObjectId | string;
  blockedUserId: Types.ObjectId | string;
  companyCode: string;
  reason?: string;
  createdAt: Date;
}
