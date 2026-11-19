import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema, Document } from 'mongoose';

export interface IFoodImage extends Document {
  name: string;
  normalizedName: string;
  keywords: string[];
  category?: string;
  imageUrl: string;
  localPath?: string;
  fileSize?: number;
  mimeType?: string;
  source: 'AI' | 'UPLOAD' | 'SEED';
  prompt?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  usageCount: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const foodImageSchema = new Schema<IFoodImage>(
  {
    name: { type: String, required: true, trim: true, index: true },
    normalizedName: { type: String, required: true, trim: true, index: true },
    keywords: { type: [String], default: [], index: true },
    category: { type: String, default: 'OTHER', index: true },
    imageUrl: { type: String, required: true },
    localPath: { type: String, default: null },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: 'image/jpeg' },
    source: { type: String, enum: ['AI', 'UPLOAD', 'SEED'], default: 'AI', index: true },
    prompt: { type: String, default: '' },
    calories: { type: Number, default: null },
    protein: { type: Number, default: null },
    carbs: { type: Number, default: null },
    fat: { type: Number, default: null },
    usageCount: { type: Number, default: 0, min: 0, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

foodImageSchema.index({ normalizedName: 1, usageCount: -1 });
foodImageSchema.index({ category: 1, usageCount: -1 });
foodImageSchema.index({ name: 'text', keywords: 'text' });foodImageSchema.plugin(centerTenantPlugin);



export default mongoose.model<IFoodImage>('FoodImage', foodImageSchema);
