import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type PhotoStage = 'BEFORE' | 'AFTER' | 'PROGRESS';
export type PhotoAngle = 'FRONT' | 'SIDE' | 'BACK' | 'OTHER';

export interface IProgressPhoto {
  customerId: Types.ObjectId;
  ptId: Types.ObjectId;
  photoUrl: string;
  takenDate: Date;
  stage: PhotoStage;
  angle: PhotoAngle;
  weight?: number;
  bodyFat?: number;
  notes?: string;
}

export type ProgressPhotoDocument = Document & IProgressPhoto;

const progressPhotoSchema = new Schema<IProgressPhoto>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
    ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    photoUrl: { type: String, required: true, trim: true },
    takenDate: { type: Date, required: true, default: Date.now, index: true },
    stage: { type: String, enum: ['BEFORE', 'AFTER', 'PROGRESS'], default: 'PROGRESS', index: true },
    angle: { type: String, enum: ['FRONT', 'SIDE', 'BACK', 'OTHER'], default: 'FRONT' },
    weight: { type: Number, min: 0, default: null },
    bodyFat: { type: Number, min: 0, max: 100, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

progressPhotoSchema.index({ customerId: 1, takenDate: -1 });progressPhotoSchema.plugin(centerTenantPlugin);



export default mongoose.model<IProgressPhoto>('ProgressPhoto', progressPhotoSchema);
