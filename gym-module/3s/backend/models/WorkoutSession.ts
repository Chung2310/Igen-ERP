import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
import { TRACKING_TYPES } from '../types/exerciseTracking.js';
export interface ICustomerSignature {
  signatureUrl: string;
  signedAt: Date;
  signerName?: string;
}
export interface IWorkoutSession {
  customerId: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; templateId?: mongoose.Types.ObjectId;
  workoutPlanId?: mongoose.Types.ObjectId; workoutPlanVersion?: number;
  performedAt: Date; attendance: 'PRESENT' | 'ABSENT' | 'LATE'; absenceReason: string;
  planSnapshot: Record<string, unknown>; exerciseLogs: Array<Record<string, unknown>>; feeling: string; notes: string; idempotencyKey: string;
  customerSignature?: ICustomerSignature;
}
const customerSignatureSchema = new Schema<ICustomerSignature>({
  signatureUrl: { type: String, required: true, trim: true },
  signedAt: { type: Date, default: Date.now },
  signerName: { type: String, default: '', trim: true },
}, { _id: false });
const setLogSchema = new Schema({ reps: { type: Number, min: 0 }, weight: { type: Number, min: 0 }, rpe: { type: Number, min: 0, max: 10 }, rir: { type: Number, min: 0 }, completed: { type: Boolean, default: true } }, { _id: false });
const exerciseLogSchema = new Schema({
  exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise' }, name: { type: String, required: true },
  trackingType: { type: String, enum: [...TRACKING_TYPES, 'LEGACY_STRENGTH'] }, prescribedSnapshot: { type: Schema.Types.Mixed }, result: { type: Schema.Types.Mixed },
  sets: { type: [setLogSchema], default: undefined }, notes: { type: String, default: '' },
}, { _id: false });
const schema = new Schema<IWorkoutSession>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'WorkoutTemplate' }, performedAt: { type: Date, required: true, index: true },
  workoutPlanId: { type: Schema.Types.ObjectId, ref: 'WorkoutPlan', index: true }, workoutPlanVersion: { type: Number, min: 1 },
  attendance: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE'], required: true }, absenceReason: { type: String, default: '' },
  planSnapshot: { type: Schema.Types.Mixed, required: true }, exerciseLogs: { type: [exerciseLogSchema], default: [] },
  feeling: { type: String, default: '' }, notes: { type: String, default: '' }, idempotencyKey: { type: String, required: true },
  customerSignature: { type: customerSignatureSchema, default: undefined },
}, { timestamps: true });
schema.index({ ptId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ customerId: 1, workoutPlanId: 1, performedAt: -1 });schema.plugin(centerTenantPlugin);


export default mongoose.model<IWorkoutSession>('WorkoutSession', schema);
