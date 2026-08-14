import type { Document, Types } from "mongoose";

export interface IPartnerKpi extends Document {
  companyCode: string;
  branchId?: string;
  partnerId: Types.ObjectId;
  periodStart: string;
  periodEnd: string;
  targetReferrals: number;
  note?: string;
  createdBy?: { id: string; name: string; email: string };
  updatedBy?: { id: string; name: string; email: string };
  createdAt?: Date;
  updatedAt?: Date;
}
