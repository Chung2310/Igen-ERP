import { Schema, model, Document } from "mongoose";
import type { BankTransferPayment } from "../../shared/wallet";

export interface ITransaction extends Document {
  userId: string;
  payerType?: "company";
  payerId?: string;
  orderCode: number;
  amount: number;
  type: "deposit" | "payment" | "withdraw";
  status: "pending" | "success" | "failed";
  paymentLinkId?: string;
  checkoutUrl?: string;
  description?: string;
  createdAt: Date;
  completedAt?: Date;
  paymentProvider?: "payos" | "sepay" | "mock";
  bankTransfer?: BankTransferPayment;
  sepayTransactionId?: string;
  aiRequestId?: string;
  aiUsage?: {
    provider: string; generationId?: string; task: string; model: string;
    promptTokens?: number; completionTokens?: number; costUSD?: number; usdToVnd: number;
  };
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: String, required: true, index: true },
  payerType: { type: String, enum: ["company"] },
  payerId: { type: String, index: true },
  orderCode: { type: Number, required: true, unique: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["deposit", "payment", "withdraw"], default: "deposit" },
  status: { type: String, enum: ["pending", "success", "failed"], default: "pending", index: true },
  paymentLinkId: { type: String },
  checkoutUrl: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
  paymentProvider: { type: String, enum: ["payos", "sepay", "mock"] },
  bankTransfer: {
    type: new Schema({
      bank: String, accountNumber: String, accountName: String, qrAccountNumber: String,
      subAccount: String, amountVND: Number, transferContent: String, paymentCode: String, qrUrl: String,
    }, { _id: false }),
    default: undefined,
  },
  sepayTransactionId: { type: String, unique: true, sparse: true },
  aiRequestId: { type: String, unique: true, sparse: true },
  aiUsage: {
    type: new Schema({
      provider: String, generationId: String, task: String, model: String,
      promptTokens: Number, completionTokens: Number, costUSD: Number, usdToVnd: Number,
    }, { _id: false }),
    default: undefined,
  },
});

export const TransactionModel = model<ITransaction>("Transaction", TransactionSchema);
