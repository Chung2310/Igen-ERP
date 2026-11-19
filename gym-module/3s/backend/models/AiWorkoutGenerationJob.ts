import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
import type { WorkoutGenerationInput } from '../services/aiWorkoutService.js';

export type AiWorkoutGenerationJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export interface IAiWorkoutGenerationJob {
  ownerPtId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  clientType: 'WEB' | 'MOBILE';
  idempotencyKey: string;
  status: AiWorkoutGenerationJobStatus;
  input: WorkoutGenerationInput;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
}

const schema = new Schema<IAiWorkoutGenerationJob>({
  ownerPtId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  clientType: { type: String, enum: ['WEB', 'MOBILE'], required: true, default: 'WEB' },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 100 },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'],
    default: 'PENDING',
    required: true,
    index: true,
  },
  input: { type: Schema.Types.Mixed, required: true },
  result: { type: Schema.Types.Mixed },
  error: {
    code: { type: String, trim: true, maxlength: 100 },
    message: { type: String, trim: true, maxlength: 500 },
  },
  attempts: { type: Number, min: 0, default: 0, required: true },
  startedAt: Date,
  completedAt: Date,
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000) },
}, { timestamps: true });

schema.index({ ownerPtId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ status: 1, createdAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });schema.plugin(centerTenantPlugin);



export default mongoose.model<IAiWorkoutGenerationJob>('AiWorkoutGenerationJob', schema);
