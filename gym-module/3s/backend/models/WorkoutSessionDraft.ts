import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

interface IWorkoutSessionDraft {
  ownerId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  revision: number;
  idempotencyKey: string;
  form: Record<string, unknown>;
  plan: Record<string, unknown>;
  pendingPayload: Record<string, unknown> | null;
}
const schema = new Schema<IWorkoutSessionDraft>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true },
  revision: { type: Number, required: true, default: 1 },
  idempotencyKey: { type: String, required: true },
  form: { type: Schema.Types.Mixed, required: true },
  plan: { type: Schema.Types.Mixed, required: true },
  pendingPayload: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, minimize: false });
schema.index({ ownerId: 1, customerId: 1 }, { unique: true });schema.plugin(centerTenantPlugin);


export default mongoose.model<IWorkoutSessionDraft>('WorkoutSessionDraft', schema);
