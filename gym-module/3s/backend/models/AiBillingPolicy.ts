import mongoose, { Schema } from 'mongoose';
import { AI_TASK_TYPES, type AiTaskType } from '../services/creditTypes.js';

export interface IAiBillingPolicy {
  taskType: AiTaskType;
  enabled: boolean;
  maxReservationCredits: number;
  fallbackCredits: number;
  markupBasisPoints: number;
  minBillableCredits: number;
  updatedById?: mongoose.Types.ObjectId;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger, required: true } as const;

const aiBillingPolicySchema = new Schema<IAiBillingPolicy>({
  taskType: { type: String, enum: AI_TASK_TYPES, required: true, unique: true },
  enabled: { type: Boolean, default: true, required: true },
  maxReservationCredits: { type: Number, min: 1, validate: Number.isInteger, required: true },
  fallbackCredits: nonNegativeInteger,
  markupBasisPoints: nonNegativeInteger,
  minBillableCredits: nonNegativeInteger,
  updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

aiBillingPolicySchema.path('fallbackCredits').validate(function (this: IAiBillingPolicy, value: number) {
  return value <= this.maxReservationCredits;
}, 'fallbackCredits không được vượt quá maxReservationCredits.');

export default mongoose.model<IAiBillingPolicy>('AiBillingPolicy', aiBillingPolicySchema);

