import { Document } from "mongoose";
import type { LeadTargetModule } from "../../../../../shared/marketing-suite/lead-intake";

export interface ILeadProductSelection {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface ILeadIntakeFieldSnapshot {
  key: string;
  label: string;
  question: string;
  type: string;
  required: boolean;
  options: string[];
}

export interface ICRMTicket extends Document {
  createdAt?: Date;
  updatedAt?: Date;
  customerName: string;
  company: string;
  value: number;
  phone: string;
  avatar: string;
  email: string;
  productOfChoice: string;
  status: "cold" | "warm" | "hot" | "won" | "upsell";
  lastInteraction?: string;
  companyCode: string;
  selectedProducts?: ILeadProductSelection[];
  answers?: Record<string, string>;
  intakeSearchText?: string;
  intakeFields?: ILeadIntakeFieldSnapshot[];
  sourcePlatform?: "facebook" | "zalo" | "tiktok";
  sourceAccountId?: string;
  sourceConversationId?: string;
  intakeProfileId?: string;
  intakeProfileVersion?: number;
  intakeRevision?: number;
  intakeStaffFields?: string[];
  lastIntakeMessageId?: string;
  lastIntakeMessageAt?: Date;
  collectionStatus?: "collecting" | "complete" | "needs_human";
  lastInteractionAt?: Date;
  moduleSync?: { targetModule: LeadTargetModule; targetRecordId: string; syncedAt: Date; syncedBy: string };
}
