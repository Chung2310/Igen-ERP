import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: false, default: null, index: true },
  detectedCustomerName: { type: String, default: null },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  measurementDate: { type: Date, required: true },
  weight: { type: Number, required: true, min: 0 },
  height: { type: Number, min: 0, default: null },
  bmi: { type: Number, min: 0, default: null },
  bodyFatPercentage: { type: Number, min: 0, max: 100, default: null },
  bodyFatMass: { type: Number, min: 0, default: null },
  muscleMass: { type: Number, min: 0, default: null },
  bmr: { type: Number, min: 0, default: null },
  visceralFatLevel: { type: Number, min: 0, default: null },
  inbodyScore: { type: Number, min: 0, default: null },
  bodyWater: { type: Number, min: 0, default: null },
  boneMineral: { type: Number, min: 0, default: null },
  waistHipRatio: { type: Number, min: 0, default: null },
  segmentalMuscle: {
    rightArm: { type: Number, default: null },
    leftArm: { type: Number, default: null },
    trunk: { type: Number, default: null },
    rightLeg: { type: Number, default: null },
    leftLeg: { type: Number, default: null },
  },
  segmentalFat: {
    rightArm: { type: Number, default: null },
    leftArm: { type: Number, default: null },
    trunk: { type: Number, default: null },
    rightLeg: { type: Number, default: null },
    leftLeg: { type: Number, default: null },
  },
  consultationNotes: { type: String, default: '' },
  strengths: { type: String, default: '' },
  priorities: { type: String, default: '' },
  recommendation: { type: String, default: '' },
  source: { type: String, enum: ['MANUAL', 'AI_SCAN'], default: 'MANUAL' },
  ocrStatus: { type: String, enum: ['NOT_APPLICABLE', 'REVIEW_REQUIRED', 'CONFIRMED'], default: 'NOT_APPLICABLE' },
  confidence: { type: Number, min: 0, max: 1, default: null, set: (v: number | null) => (v != null && v > 1 && v <= 100 ? v / 100 : v) },
  ocrWarnings: { type: [String], default: [] },
  sourceImage: {
    fileName: { type: String, default: '' }, mimeType: { type: String, default: '' }, data: { type: Buffer, default: null },
  },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  publishedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.sourceImage;
      return ret;
    },
  },
});schema.plugin(centerTenantPlugin);



export default mongoose.model('InBodyRecord', schema);
