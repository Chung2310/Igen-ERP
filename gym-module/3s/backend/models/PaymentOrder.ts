import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

export type PaymentGateway = 'SEPAY' | 'PAYOS' | 'VNPAY' | 'MOMO';
export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';

export interface BankTransferDetails {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  content: string;
  webhookAccountNumber: string;
  subAccount: string;
}

export interface IPaymentOrder {
  bankTransfer?: BankTransferDetails;
  userId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  gateway: PaymentGateway;
  orderCode: string;
  status: PaymentOrderStatus;
  source: 'PACKAGE' | 'CUSTOM';
  packageId?: mongoose.Types.ObjectId;
  amountVnd: number;
  baseCredits: number;
  bonusCredits: number;
  grantCredits: number;
  gatewayTransactionId?: string;
  gatewayRequestId?: string;
  gatewayResultCode?: string;
  paidAt?: Date;
  expiresAt: Date;
  grantIdempotencyKey: string;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger, required: true } as const;

const paymentOrderSchema = new Schema<IPaymentOrder>({
  bankTransfer: { type: new Schema<BankTransferDetails>({
    bankCode: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountHolder: { type: String, required: true },
    content: { type: String, required: true },
    webhookAccountNumber: { type: String, required: true },
    subAccount: { type: String, default: '' },
  }, { _id: false }), default: undefined },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'CreditWallet', required: true, index: true },
  gateway: { type: String, enum: ['SEPAY', 'PAYOS', 'VNPAY', 'MOMO'], required: true, index: true },
  orderCode: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED'], required: true, default: 'PENDING', index: true },
  source: { type: String, enum: ['PACKAGE', 'CUSTOM'], required: true },
  packageId: { type: Schema.Types.ObjectId, ref: 'CreditPackage' },
  amountVnd: { type: Number, min: 10_000, max: 50_000_000, validate: Number.isInteger, required: true },
  baseCredits: nonNegativeInteger,
  bonusCredits: nonNegativeInteger,
  grantCredits: nonNegativeInteger,
  gatewayTransactionId: { type: String, trim: true },
  gatewayRequestId: { type: String, trim: true },
  gatewayResultCode: { type: String, trim: true },
  paidAt: Date,
  expiresAt: { type: Date, required: true, index: true },
  grantIdempotencyKey: { type: String, required: true, unique: true, trim: true },
}, { timestamps: true });

paymentOrderSchema.index(
  { gateway: 1, gatewayTransactionId: 1 },
  { unique: true, partialFilterExpression: { gatewayTransactionId: { $type: 'string' } } },
);
paymentOrderSchema.index({ userId: 1, createdAt: -1 });paymentOrderSchema.plugin(centerTenantPlugin);



export default mongoose.model<IPaymentOrder>('PaymentOrder', paymentOrderSchema);
