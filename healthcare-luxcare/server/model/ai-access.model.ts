import { Schema, model, type Document } from "mongoose";

export interface IFreeAiRequest extends Document {
  requestKey: string;
  userId: string;
  question: string;
  answer?: string;
  status: "reserved" | "running" | "completed" | "failed" | "cancelled";
  costUSD?: number;
  budgetUSD: number;
  createdAt: Date;
  expiresAt: Date;
}
const freeRequestSchema = new Schema<IFreeAiRequest>({
  requestKey: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  question: { type: String, required: true },
  answer: String,
  status: { type: String, enum: ["reserved", "running", "completed", "failed", "cancelled"], required: true },
  costUSD: Number,
  budgetUSD: { type: Number, required: true },
  createdAt: { type: Date, required: true, index: true },
  expiresAt: { type: Date, required: true },
});
freeRequestSchema.index({ userId: 1, createdAt: -1 });
freeRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const FreeAiRequestModel = model<IFreeAiRequest>("FreeAiRequest", freeRequestSchema);

export interface IFreeAiGuard extends Document { key: string; version: number }
const guardSchema = new Schema<IFreeAiGuard>({
  key: { type: String, required: true, unique: true },
  version: { type: Number, default: 0 },
});
export const FreeAiGuardModel = model<IFreeAiGuard>("FreeAiGuard", guardSchema);

export interface ICompanyWallet extends Document { companyCode: string; balance: number; updatedAt: Date }
const companyWalletSchema = new Schema<ICompanyWallet>({
  companyCode: { type: String, required: true, unique: true },
  balance: { type: Number, min: 0, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});
export const CompanyWalletModel = model<ICompanyWallet>("CompanyWallet", companyWalletSchema);
