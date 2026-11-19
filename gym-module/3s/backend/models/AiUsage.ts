import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
import { AI_TASK_TYPES, type AiBillingMode, type AiTaskType, type PricingSnapshot } from '../services/creditTypes.js';

export type AiUsageStatus = 'RESERVED' | 'SUCCEEDED' | 'FAILED' | 'BILLING_SHORTFALL';

export interface IAiUsage {
  userId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  taskType: AiTaskType;
  billingMode: AiBillingMode;
  provider: string;
  model: string;
  status: AiUsageStatus;
  requestKey: string;
  reservedCredits: number;
  settledCredits: number;
  releasedCredits: number;
  billingShortfall: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  providerCostMicrousd?: number;
  quotaPeriodKeys?: { dayKey: string; monthKey: string };
  globalBudgetMonthKey?: string;
  reservedProviderCostVnd?: number;
  pricingSnapshot: PricingSnapshot;
  failureCode?: string;
  leaseExpiresAt?: Date;
  createdAt?: Date;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger, required: true } as const;
const optionalNonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger } as const;

const pricingSnapshotSchema = new Schema<PricingSnapshot>({
  usdToVnd: { type: Number, min: 1, validate: Number.isInteger, required: true },
  vndPerCredit: { type: Number, min: 1, validate: Number.isInteger, required: true },
  markupBasisPoints: { type: Number, min: 0, validate: Number.isInteger, required: true },
  fallbackCredits: nonNegativeInteger,
  minBillableCredits: nonNegativeInteger,
  maxReservationCredits: nonNegativeInteger,
}, { _id: false });

const aiUsageSchema = new Schema<IAiUsage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletId: { type: Schema.Types.ObjectId, ref: 'CreditWallet', required: true, index: true },
  taskType: { type: String, enum: AI_TASK_TYPES, required: true, index: true },
  billingMode: { type: String, enum: ['WALLET', 'COMPANY_PAID'], default: 'WALLET', required: true },
  provider: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  status: { type: String, enum: ['RESERVED', 'SUCCEEDED', 'FAILED', 'BILLING_SHORTFALL'], required: true, index: true },
  requestKey: { type: String, required: true, unique: true, trim: true },
  reservedCredits: { ...nonNegativeInteger, default: 0 },
  settledCredits: { ...nonNegativeInteger, default: 0 },
  releasedCredits: { ...nonNegativeInteger, default: 0 },
  billingShortfall: { ...nonNegativeInteger, default: 0 },
  inputTokens: optionalNonNegativeInteger,
  outputTokens: optionalNonNegativeInteger,
  totalTokens: optionalNonNegativeInteger,
  providerCostMicrousd: optionalNonNegativeInteger,
  quotaPeriodKeys: {
    dayKey: { type: String, trim: true, maxlength: 10 },
    monthKey: { type: String, trim: true, maxlength: 7 },
  },
  globalBudgetMonthKey: { type: String, trim: true, maxlength: 7 },
  reservedProviderCostVnd: optionalNonNegativeInteger,
  pricingSnapshot: { type: pricingSnapshotSchema, required: true },
  failureCode: { type: String, trim: true, maxlength: 100 },
  leaseExpiresAt: { type: Date },
}, { timestamps: true });

aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ status: 1, leaseExpiresAt: 1 });
aiUsageSchema.index({ status: 1, createdAt: -1 });aiUsageSchema.plugin(centerTenantPlugin);



export default mongoose.model<IAiUsage>('AiUsage', aiUsageSchema);

