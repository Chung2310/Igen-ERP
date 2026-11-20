import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  bmr: { type: Number, min: 0, default: null },
  tdee: { type: Number, min: 0, default: null },
  targetCalories: { type: Number, min: 0, required: true },
  macros: {
    protein: { type: Number, min: 0, required: true },
    carbs: { type: Number, min: 0, required: true },
    fat: { type: Number, min: 0, required: true },
  },
  startDate: { type: Date, default: null, index: true },
  endDate: { type: Date, default: null, index: true },
  durationDays: { type: Number, min: 1, max: 31, default: 7 },
  menu: { type: [mongoose.Schema.Types.Mixed], default: [] },
  dailyPlans: { type: [mongoose.Schema.Types.Mixed], default: [] },
  notes: { type: String, default: '' },
  createdByAi: { type: Boolean, default: false },
  reviewStatus: { type: String, enum: ['NOT_REQUIRED', 'PT_REVIEW_REQUIRED', 'APPROVED', 'REJECTED'], default: 'NOT_REQUIRED' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  publishedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });schema.plugin(centerTenantPlugin);



export default mongoose.model('NutritionPlan', schema);
