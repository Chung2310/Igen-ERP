import mongoose, { Schema } from 'mongoose';
import type { UserRole } from './User.js';

export const FEATURE_KEYS = [
  'OCR_INBODY', 'ROADMAP', 'EXERCISE_LIBRARY', 'PROGRESS', 'CARE',
  'DASHBOARD', 'NUTRITION_AI', 'KNOWLEDGE_BASE', 'PT_ASSISTANT',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface IFeatureFlag {
  key: FeatureKey;
  enabled: boolean;
  roles: UserRole[];
  pilotUserIds: mongoose.Types.ObjectId[];
  centerId?: mongoose.Types.ObjectId | null;
}

const featureFlagSchema = new Schema<IFeatureFlag>({
  key: { type: String, enum: FEATURE_KEYS, required: true },
  enabled: { type: Boolean, default: false },
  roles: [{ type: String, enum: ['ADMIN', 'PT', 'CUSTOMER'] }],
  pilotUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  centerId: { type: Schema.Types.ObjectId, ref: 'Center', default: null },
}, { timestamps: true });
featureFlagSchema.index({ centerId: 1, key: 1 }, { name: 'unique_feature_key_per_center', unique: true });

export default mongoose.model<IFeatureFlag>('FeatureFlag', featureFlagSchema);
