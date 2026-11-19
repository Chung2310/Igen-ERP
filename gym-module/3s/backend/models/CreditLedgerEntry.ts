import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

export type CreditLedgerType = 'TOPUP' | 'RESERVE' | 'SETTLE' | 'RELEASE' | 'ADJUSTMENT';
export type CreditReferenceType = 'AI_USAGE' | 'PAYMENT_ORDER' | 'ADMIN_ADJUSTMENT';

export interface ICreditLedgerEntry {
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: CreditLedgerType;
  availableDelta: number;
  reservedDelta: number;
  availableAfter: number;
  reservedAfter: number;
  referenceType: CreditReferenceType;
  referenceId: string;
  idempotencyKey: string;
  reason: string;
  actorUserId?: mongoose.Types.ObjectId;
}

const integer = { type: Number, validate: Number.isInteger, required: true } as const;
const nonNegativeInteger = { ...integer, min: 0 } as const;

const creditLedgerEntrySchema = new Schema<ICreditLedgerEntry>({
  walletId: { type: Schema.Types.ObjectId, ref: 'CreditWallet', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['TOPUP', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT'], required: true, index: true },
  availableDelta: integer,
  reservedDelta: integer,
  availableAfter: nonNegativeInteger,
  reservedAfter: nonNegativeInteger,
  referenceType: { type: String, enum: ['AI_USAGE', 'PAYMENT_ORDER', 'ADMIN_ADJUSTMENT'], required: true },
  referenceId: { type: String, required: true, trim: true },
  idempotencyKey: { type: String, required: true, unique: true, trim: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

creditLedgerEntrySchema.index({ userId: 1, createdAt: -1 });
creditLedgerEntrySchema.index({ referenceType: 1, referenceId: 1 });creditLedgerEntrySchema.plugin(centerTenantPlugin);



export default mongoose.model<ICreditLedgerEntry>('CreditLedgerEntry', creditLedgerEntrySchema);

