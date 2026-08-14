import type { Document, Types } from "mongoose";
import type { CommissionScheme, ReferralStatus } from "../contracts";

export interface IWorkerReferral extends Document {
  companyCode: string;
  branchId?: string;
  partnerId: Types.ObjectId;
  workerId: Types.ObjectId;
  policyId: Types.ObjectId;
  commissionScheme: CommissionScheme;
  referredAt: string;
  employmentStartDate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: ReferralStatus;
  confirmationSource: "contract" | "manual" | "attendance";
  confirmedBy?: string;
  confirmedAt?: Date | null;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
