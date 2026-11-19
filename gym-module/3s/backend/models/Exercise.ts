import mongoose, { Schema } from 'mongoose';
import { sharedCenterCatalogPlugin } from '../tenancy/centerTenantPlugin.js';
import { TRACKING_TYPES, type TrackingType } from '../types/exerciseTracking.js';
export interface IExerciseVideo {
  title: string;
  url: string;
  source: 'UPLOAD' | 'LINK';
}
export interface IExercise {
  name: string; muscleGroup: string; muscleGroups?: string[]; level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  equipment: string[]; description: string; videoUrl: string; videos: IExerciseVideo[]; technique: string; commonMistakes: string[];
  contraindications: string[]; variants: string[]; scope: 'GLOBAL' | 'PRIVATE'; ownerPtId?: mongoose.Types.ObjectId; centerId?: mongoose.Types.ObjectId | null;
  defaultTrackingType: TrackingType;
}
const exerciseVideoSchema = new Schema<IExerciseVideo>({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  source: { type: String, enum: ['UPLOAD', 'LINK'], required: true },
}, { _id: false });
const schema = new Schema<IExercise>({
  name: { type: String, required: true, trim: true, index: true },
  muscleGroup: { type: String, required: true, index: true },
  muscleGroups: { type: [String], default: [], index: true },
  level: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], required: true, index: true },
  equipment: { type: [String], default: [] }, description: { type: String, default: '' }, videoUrl: { type: String, default: '' }, videos: { type: [exerciseVideoSchema], default: [] }, technique: { type: String, default: '' },
  commonMistakes: { type: [String], default: [] }, contraindications: { type: [String], default: [] }, variants: { type: [String], default: [] },
  defaultTrackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED', index: true },
  scope: { type: String, enum: ['GLOBAL', 'PRIVATE'], default: 'GLOBAL', index: true }, ownerPtId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

schema.pre('save', function () {
  if (Array.isArray(this.muscleGroups) && this.muscleGroups.length > 0) {
    this.muscleGroup = this.muscleGroups.map((s) => String(s).trim()).filter(Boolean).join(', ');
  } else if (typeof this.muscleGroup === 'string' && this.muscleGroup.trim()) {
    this.muscleGroups = this.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean);
  }
});

schema.index({ scope: 1, ownerPtId: 1, muscleGroup: 1, level: 1, defaultTrackingType: 1 });
schema.plugin(sharedCenterCatalogPlugin);
export default mongoose.model<IExercise>('Exercise', schema);

