import { Schema, model, type Types } from "mongoose";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import type { TelecomInvoicePlatform } from "../../../../../shared/marketing-suite/telecom-invoice";

const scope = {
  companyCode: { type: String, required: true },
  provider: { type: String, required: true },
};
const contractSchema = new Schema({
  ...scope,
  code: { type: String, required: true },
  leadId: { type: Schema.Types.ObjectId, required: true },
  firstSeenAt: { type: Date, required: true },
});
contractSchema.index({ companyCode: 1, provider: 1, code: 1 }, { unique: true });
contractSchema.index({ companyCode: 1, leadId: 1 });
export const LeadContractModel = model("LeadContract", contractSchema);

export type ContractPhotoRecord = {
  companyCode: string;
  provider: string;
  platform: TelecomInvoicePlatform;
  pageId: string;
  conversationId: string;
  messageId: string;
  sourceIndex: number;
  imageKey: string;
  receivedAt: Date;
  leaseUntil?: Date;
  status: "reading" | "review" | "recorded" | "other";
  contractCode?: string;
  leadId?: Types.ObjectId;
  values: Record<string, string>;
  fields: LeadIntakeField[];
  contractFieldKey: string;
  issue?: string;
};
const photoSchema = new Schema<ContractPhotoRecord>({
  ...scope,
  platform: { type: String, enum: ["facebook", "zalo"], required: true },
  pageId: { type: String, required: true },
  conversationId: { type: String, required: true },
  messageId: { type: String, required: true },
  sourceIndex: { type: Number, required: true },
  imageKey: { type: String, required: true },
  receivedAt: { type: Date, required: true },
  leaseUntil: Date,
  status: { type: String, enum: ["reading", "review", "recorded", "other"], required: true },
  contractCode: String,
  leadId: Schema.Types.ObjectId,
  values: { type: Schema.Types.Mixed, default: {} },
  fields: { type: Schema.Types.Mixed, required: true },
  contractFieldKey: { type: String, required: true },
  issue: String,
});
photoSchema.index({ companyCode: 1, provider: 1, imageKey: 1 }, { unique: true });
photoSchema.index({ companyCode: 1, platform: 1, pageId: 1, conversationId: 1, messageId: 1, sourceIndex: 1 }, { unique: true });
photoSchema.index({ companyCode: 1, status: 1, receivedAt: -1, _id: -1 });
photoSchema.index({ companyCode: 1, provider: 1, status: 1, receivedAt: 1 });
photoSchema.index({ companyCode: 1, leadId: 1, receivedAt: -1 });
export const LeadContractPhotoModel = model("LeadContractPhoto", photoSchema);
