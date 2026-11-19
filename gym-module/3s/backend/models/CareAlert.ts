import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface ICareAlert { customerId: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; ruleKey: string; title: string; reason: string; status: 'OPEN' | 'RESOLVED'; dueAt: Date; resolvedAt?: Date; resolvedById?: mongoose.Types.ObjectId; result: string }
const schema = new Schema<ICareAlert>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ruleKey: { type: String, required: true, index: true }, title: { type: String, required: true }, reason: { type: String, required: true },
  status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN', index: true }, dueAt: { type: Date, required: true },
  resolvedAt: Date, resolvedById: { type: Schema.Types.ObjectId, ref: 'User' }, result: { type: String, default: '' },
}, { timestamps: true });
schema.index({ customerId: 1, ruleKey: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } });
schema.index({ ptId: 1, status: 1, dueAt: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model<ICareAlert>('CareAlert', schema);
