import { Schema, model } from "mongoose";
import type { ZbsBatch, ZbsTemplate, ZbsParam, ZbsRow } from "../../../../../shared/marketing-suite/zbs";

const paramSchema = new Schema<ZbsParam>({ name: String, required: Boolean, type: String, minLength: Number, maxLength: Number, acceptNull: Boolean }, { _id: false });
const buttonSchema = new Schema({ title: String, content: String, type: Number }, { _id: false });
const rowSchema = new Schema<ZbsRow>({
  id: { type: String, required: true }, leadId: String, name: String, recipient: String,
  method: { type: String, enum: ["uid", "phone"], required: true }, data: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["blocked", "pending", "sending", "accepted", "delivered", "read", "failed", "unknown", "cancelled"], required: true },
  reason: String, trackingId: String, messageId: String, sentAt: String, deliveredAt: String, readAt: String,
  suggestedMethod: { type: String, enum: ["phone"] },
}, { _id: false });

export type StoredTemplate = Omit<ZbsTemplate, "syncedAt"> & { companyCode: string; oaId: string; appId: string; syncedAt: Date };
const templateSchema = new Schema<StoredTemplate>({
  companyCode: { type: String, required: true }, oaId: { type: String, required: true }, appId: { type: String, required: true },
  templateId: { type: String, required: true }, name: String, status: String,
  params: { type: [paramSchema], default: [] }, buttons: { type: [buttonSchema], default: [] },
  previewUrl: String, uidSupported: Boolean, phoneSupported: Boolean, priceUid: Number, pricePhone: Number,
  mapping: { type: Schema.Types.Mixed, default: {} }, syncedAt: Date,
}, { versionKey: false });
templateSchema.index({ companyCode: 1, oaId: 1, appId: 1, templateId: 1 }, { unique: true });
export const ZbsTemplateModel = model<StoredTemplate>("ZbsTemplate", templateSchema);

export type StoredBatch = Omit<ZbsBatch, "id" | "createdAt" | "expiresAt" | "confirmedAt"> & {
  companyCode: string; appId: string; createdBy: string; confirmedBy?: string; createdAt: Date; expiresAt: Date;
  confirmedAt?: Date; templateHash: string; leaseUntil?: Date; leaseToken?: string;
};
const batchSchema = new Schema<StoredBatch>({
  companyCode: { type: String, required: true }, appId: { type: String, required: true },
  createdBy: { type: String, required: true }, confirmedBy: String, name: String,
  oaId: { type: String, required: true }, templateId: String, templateName: String, method: { type: String, enum: ["uid", "phone"] },
  status: { type: String, enum: ["draft", "queued", "running", "paused", "completed", "cancelled"], required: true },
  test: Boolean, development: Boolean, rows: { type: [rowSchema], required: true },
  estimatedCost: Number, expiresAt: Date, confirmedAt: Date, templateHash: String, leaseUntil: Date, leaseToken: String,
}, { timestamps: true, versionKey: false });
batchSchema.index({ companyCode: 1, createdAt: -1 });
batchSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
export const ZbsBatchModel = model<StoredBatch>("ZbsBatch", batchSchema);

const lockSchema = new Schema({ _id: String, owner: String, until: Date, nextAt: Date }, { versionKey: false });
export const ZbsOaLockModel = model("ZbsOaLock", lockSchema);

// Keep unmatched receipts: a delivery webhook can arrive before the send response is stored.
const receiptSchema = new Schema({
  appId: String, oaId: String, method: String, messageId: String, trackingId: String, recipient: String,
  status: String, at: Date, receivedAt: Date,
}, { versionKey: false });
receiptSchema.index({ appId: 1, oaId: 1, method: 1, messageId: 1, status: 1 }, { unique: true });
export const ZbsReceiptModel = model("ZbsReceipt", receiptSchema);
