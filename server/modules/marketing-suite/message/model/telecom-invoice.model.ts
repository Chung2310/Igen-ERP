import { Schema, model } from "mongoose";
import { DEFAULT_TELECOM_INVOICE_FIELDS, type TelecomInvoiceField, type TelecomInvoicePlatform, type TelecomInvoiceValues } from "../../../../../shared/marketing-suite/telecom-invoice";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";

const pageScope = {
  companyCode: { type: String, required: true },
  pageId: { type: String, required: true },
};
const conversationScope = { ...pageScope, conversationId: { type: String, required: true }, platform: { type: String, enum: ["facebook", "zalo"] } };
const fieldList = { type: [String], enum: DEFAULT_TELECOM_INVOICE_FIELDS, required: true };

const settingsFields = {
  enabled: { type: Boolean, required: true, default: false },
  subscriberFieldKey: String,
  mode: { type: String, enum: ["invoice", "contract"] },
  contractFieldKey: String,
  contractProvider: String,
};
// Keep existing Facebook settings on the root and store the Zalo settings independently.
const settingsSchema = new Schema({ ...pageScope, ...settingsFields, zalo: { type: new Schema(settingsFields, { _id: false }) } });
settingsSchema.index({ companyCode: 1, pageId: 1 }, { unique: true });
settingsSchema.index({ pageId: 1 });
export const TelecomInvoiceSettingsModel = model("TelecomInvoiceSettings", settingsSchema);

export type TelecomInvoiceAccount = { companyCode: string; pageId: string; platform: TelecomInvoicePlatform };

export function enabledLeadContractAccount({ pageId, platform }: Pick<TelecomInvoiceAccount, "pageId" | "platform">) {
  return platform === "zalo" ? { pageId, "zalo.enabled": true, "zalo.mode": "contract" as const }
    : { pageId, enabled: true, mode: "contract" as const };
}

export function enabledTelecomInvoiceAccount({ companyCode, pageId, platform }: TelecomInvoiceAccount) {
  return { companyCode, pageId, ...(platform === "zalo"
    ? { "zalo.enabled": true, "zalo.mode": { $ne: "contract" } }
    : { enabled: true, mode: { $ne: "contract" } }) };
}

const conversationSchema = new Schema({ ...conversationScope, sequence: { type: Number, required: true } });
conversationSchema.index({ companyCode: 1, pageId: 1, conversationId: 1 }, { unique: true });
export const TelecomInvoiceConversationModel = model("TelecomInvoiceConversation", conversationSchema);

export interface TelecomInvoiceDraft {
  companyCode: string;
  pageId: string;
  platform?: TelecomInvoicePlatform;
  conversationId: string;
  sourceMessageId: string;
  sourceIndex: number;
  imageNumber: number;
  imageHash?: string;
  recordedImageHash?: string;
  fields?: TelecomInvoiceField[];
  leadFields?: LeadIntakeField[];
  subscriberFieldKey?: string;
  values: TelecomInvoiceValues;
  status: "pending" | "confirmed" | "duplicate" | "skipped" | "other";
  readFailed?: boolean;
  imageIssue?: "blurry" | "multiple" | "unreadable" | "download" | "processing";
  unclearFields?: string[];
  autoEligible?: boolean;
  revision: number;
  presentedRevision?: number;
  presentedMessageId?: string;
  presentedAt?: Date;
  resolvedByMessageId?: string;
  editMessageId?: string;
  subscriberCode?: string;
  invoiceKey?: string;
  confirmedAt?: Date;
  expiresAt?: Date;
}

const invoiceSchema = new Schema<TelecomInvoiceDraft>({
  ...conversationScope,
  sourceMessageId: { type: String, required: true }, sourceIndex: { type: Number, required: true },
  imageNumber: { type: Number, required: true }, imageHash: String, recordedImageHash: String,
  fields: { ...fieldList, required: false, default: undefined }, leadFields: { type: Schema.Types.Mixed },
  subscriberFieldKey: String, values: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["pending", "confirmed", "duplicate", "skipped", "other"], required: true },
  readFailed: Boolean,
  imageIssue: { type: String, enum: ["blurry", "multiple", "unreadable", "download", "processing"] },
  unclearFields: { type: [String], default: undefined },
  autoEligible: Boolean,
  revision: { type: Number, required: true, default: 1 }, presentedRevision: Number,
  presentedMessageId: String, presentedAt: Date, resolvedByMessageId: String, editMessageId: String,
  subscriberCode: String, invoiceKey: String, confirmedAt: Date, expiresAt: Date,
});
invoiceSchema.index({ companyCode: 1, pageId: 1, conversationId: 1, sourceMessageId: 1, sourceIndex: 1 }, { unique: true });
invoiceSchema.index({ companyCode: 1, pageId: 1, conversationId: 1, status: 1, imageNumber: 1 });
invoiceSchema.index({ companyCode: 1, pageId: 1, conversationId: 1, resolvedByMessageId: 1 });
invoiceSchema.index({ companyCode: 1, subscriberCode: 1, status: 1, _id: -1 });
invoiceSchema.index({ companyCode: 1, subscriberCode: 1, invoiceKey: 1 }, {
  unique: true, partialFilterExpression: { status: "confirmed", invoiceKey: { $type: "string" } },
});
invoiceSchema.index({ companyCode: 1, subscriberCode: 1, imageHash: 1 }, {
  unique: true, partialFilterExpression: { status: "confirmed", imageHash: { $type: "string" } },
});
invoiceSchema.index({ companyCode: 1, imageHash: 1 }, { partialFilterExpression: { status: "confirmed", imageHash: { $type: "string" } } });
// A separate key protects new writes without rebuilding the historical photo index.
invoiceSchema.index({ companyCode: 1, recordedImageHash: 1 }, {
  unique: true, partialFilterExpression: { recordedImageHash: { $type: "string" } },
});
invoiceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const TelecomInvoiceModel = model("TelecomInvoice", invoiceSchema);
