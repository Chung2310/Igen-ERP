import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['WEIGHT_LOSS', 'FAT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_GAIN', 'RECOMPOSITION', 'FITNESS'], required: true },
  title: { type: String, required: true, trim: true },
  targetValue: { type: Number, default: null },
  targetUnit: { type: String, default: '' },
  deadline: { type: Date, required: true },
  sessionsPerWeek: { type: Number, min: 1, max: 14, default: 3 },
  cardioNotes: { type: String, default: '' },
  evaluationNotes: { type: String, default: '' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  publishedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });schema.plugin(centerTenantPlugin);



export default mongoose.model('Goal', schema);
