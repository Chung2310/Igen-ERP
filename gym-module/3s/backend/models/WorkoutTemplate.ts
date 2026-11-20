import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
import { TRACKING_TYPES } from '../types/exerciseTracking.js';
export interface IWorkoutTemplate {
  ownerPtId: mongoose.Types.ObjectId; title: string; goal: string; level: string;
  durationDays: number; scheduledExercises: Array<Record<string, unknown>>;
  unscheduledExercises: Array<Record<string, unknown>>;
  muscleGroups: string[]; defaultSets?: number; defaultReps?: string; defaultWeight?: string; defaultTempo?: string; technicalNotes?: string;
  sessions: Array<Record<string, unknown>>; version: number; status: 'ACTIVE' | 'ARCHIVED';
}
const templateExerciseSchema = new Schema({
  exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, sets: { type: Number, min: 1 },
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: Schema.Types.Mixed, default: () => ({}) },
  reps: String, weight: String, rpe: { type: Number, min: 0, max: 10 }, rir: { type: Number, min: 0 },
  tempo: String, restSeconds: { type: Number, min: 0 }, notes: String,
}, { _id: false });
const templateSessionSchema = new Schema({ name: { type: String, required: true }, exercises: { type: [templateExerciseSchema], default: [] } }, { _id: false });
const scheduledExerciseSchema = new Schema({
  weekNumber: { type: Number, min: 1, default: 1 }, dayNumber: { type: Number, required: true, min: 1 }, startMinute: { type: Number, required: true, min: 0, max: 1425 }, durationMinutes: { type: Number, required: true, min: 15, max: 1440 },
  exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, muscleGroup: { type: String, default: '' }, sets: { type: Number, min: 1 }, reps: String, weight: String, rpe: { type: Number, min: 0, max: 10 }, rir: { type: Number, min: 0 }, tempo: String, restSeconds: { type: Number, min: 0 }, notes: String,
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: Schema.Types.Mixed, default: () => ({}) },
}, { _id: false });
const unscheduledExerciseSchema = new Schema({
  durationMinutes: { type: Number, required: true, min: 15, max: 1440 }, exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true }, muscleGroup: { type: String, default: '' }, sets: { type: Number, min: 1 }, reps: String, weight: String, rpe: { type: Number, min: 0, max: 10 }, rir: { type: Number, min: 0 }, tempo: String, restSeconds: { type: Number, min: 0 }, notes: String,
  trackingType: { type: String, enum: TRACKING_TYPES, default: 'UNCLASSIFIED' }, prescription: { type: Schema.Types.Mixed, default: () => ({}) },
}, { _id: false });
const schema = new Schema<IWorkoutTemplate>({
  ownerPtId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, title: { type: String, required: true, trim: true },
  goal: { type: String, required: true, index: true }, level: { type: String, required: true, index: true },
  durationDays: { type: Number, min: 1, max: 365, default: 1 }, scheduledExercises: { type: [scheduledExerciseSchema], default: [] }, unscheduledExercises: { type: [unscheduledExerciseSchema], default: [] },
  muscleGroups: { type: [String], default: [] }, defaultSets: { type: Number, min: 1 }, defaultReps: { type: String, default: '' }, defaultWeight: { type: String, default: '' }, defaultTempo: { type: String, default: '' }, technicalNotes: { type: String, default: '' },
  sessions: { type: [templateSessionSchema], default: [] }, version: { type: Number, default: 1 },
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
}, { timestamps: true });schema.plugin(centerTenantPlugin);


export default mongoose.model<IWorkoutTemplate>('WorkoutTemplate', schema);
