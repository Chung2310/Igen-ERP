import mongoose, { Schema } from 'mongoose';
import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';

export type AiUsageQuotaScope = 'USER' | 'CENTER';
export type AiUsageQuotaPeriod = 'DAY' | 'MONTH';

export interface IAiUsageQuotaCounter {
  scope: AiUsageQuotaScope;
  userId?: mongoose.Types.ObjectId;
  periodType: AiUsageQuotaPeriod;
  periodKey: string;
  usedRequests: number;
  reservedRequests: number;
  providerCostMicrousd: number;
  createdAt: Date;
  updatedAt: Date;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isSafeInteger, required: true } as const;

const schema = new Schema<IAiUsageQuotaCounter>({
  scope: { type: String, enum: ['USER', 'CENTER'], required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  periodType: { type: String, enum: ['DAY', 'MONTH'], required: true },
  periodKey: { type: String, required: true, trim: true, maxlength: 10 },
  usedRequests: { ...nonNegativeInteger, default: 0 },
  reservedRequests: { ...nonNegativeInteger, default: 0 },
  providerCostMicrousd: { ...nonNegativeInteger, default: 0 },
}, { timestamps: true });

schema.plugin(centerTenantPlugin);
schema.index(
  { centerId: 1, userId: 1, periodType: 1, periodKey: 1 },
  { name: 'unique_ai_usage_quota_user_period', unique: true, partialFilterExpression: { scope: 'USER' } },
);
schema.index(
  { centerId: 1, periodType: 1, periodKey: 1 },
  { name: 'unique_ai_usage_quota_center_period', unique: true, partialFilterExpression: { scope: 'CENTER' } },
);

export default mongoose.model<IAiUsageQuotaCounter>('AiUsageQuotaCounter', schema);
