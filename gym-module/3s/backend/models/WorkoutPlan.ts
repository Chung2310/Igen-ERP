import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
import { TRACKING_TYPES } from '../types/exerciseTracking.js';
const exerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, sets: { type: Number, min: 1 }, reps: String,
  weight: String, rest: String, tempo: String, notes: String,
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { _id: false });
const sessionSchema = new mongoose.Schema({ name: { type: String, required: true }, exercises: { type: [exerciseSchema], default: [] } }, { _id: false });
const scheduledExerciseSchema = new mongoose.Schema({
  weekNumber: { type: Number, min: 1, default: 1 }, dayNumber: { type: Number, required: true, min: 1, max: 7 }, startMinute: { type: Number, required: true, min: 0, max: 1425 }, durationMinutes: { type: Number, required: true, min: 15, max: 1440 },
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, muscleGroup: { type: String, default: '' }, sets: Number, reps: String, weight: String, rpe: Number, rir: Number, tempo: String, restSeconds: Number, notes: String,
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { _id: false });
const unscheduledExerciseSchema = new mongoose.Schema({
  durationMinutes: { type: Number, required: true, min: 15, max: 1440 }, exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, muscleGroup: { type: String, default: '' }, sets: Number, reps: String, weight: String, rpe: Number, rir: Number, tempo: String, restSeconds: Number, notes: String,
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { _id: false });
const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: true },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  sessions: { type: [sessionSchema], default: [] },
  sourceTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutTemplate', default: null, index: true },
  goal: { type: String, default: '' },
  level: { type: String, default: 'BEGINNER' },
  durationDays: { type: Number, min: 1, max: 365, default: 1 },
  muscleGroups: { type: [String], default: [] },
  defaultSets: { type: Number, min: 1 },
  defaultReps: { type: String, default: '' },
  defaultWeight: { type: String, default: '' },
  defaultTempo: { type: String, default: '' },
  technicalNotes: { type: String, default: '' },
  scheduledExercises: { type: [scheduledExerciseSchema], default: [] },
  unscheduledExercises: { type: [unscheduledExerciseSchema], default: [] },
  lifecycleStatus: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  assignedAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null },
  createdByAi: { type: Boolean, default: false },
  reviewStatus: { type: String, enum: ['NOT_REQUIRED', 'PT_REVIEW_REQUIRED', 'APPROVED', 'REJECTED'], default: 'NOT_REQUIRED' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  publishedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });

schema.index({ customerId: 1 }, { unique: true, partialFilterExpression: { lifecycleStatus: 'ACTIVE' } });schema.plugin(centerTenantPlugin);



export default mongoose.model('WorkoutPlan', schema);
