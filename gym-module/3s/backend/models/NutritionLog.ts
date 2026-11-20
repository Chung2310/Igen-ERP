import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

export interface INutritionLog {
  customerId: mongoose.Types.ObjectId;
  ptId: mongoose.Types.ObjectId;
  loggedAt: Date;
  type: 'FOOD' | 'ACTIVITY';
  name: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  durationMinutes?: number | null;
  notes: string;
}

const schema = new Schema<INutritionLog>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  loggedAt: { type: Date, required: true, index: true },
  type: { type: String, enum: ['FOOD', 'ACTIVITY'], required: true, index: true },
  name: { type: String, required: true, trim: true },
  calories: { type: Number, required: true, min: 0 },
  macros: {
    protein: { type: Number, min: 0, default: 0 },
    carbs: { type: Number, min: 0, default: 0 },
    fat: { type: Number, min: 0, default: 0 },
  },
  durationMinutes: { type: Number, min: 1, default: null },
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });

schema.index({ customerId: 1, loggedAt: -1, type: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model<INutritionLog>('NutritionLog', schema);
