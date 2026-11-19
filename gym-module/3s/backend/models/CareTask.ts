import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, assignedPtId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true }, dueAt: { type: Date, required: true, index: true }, status: { type: String, enum: ['OPEN', 'DONE'], default: 'OPEN', index: true }, result: { type: String, default: '' },
}, { timestamps: true });
schema.index({ assignedPtId: 1, status: 1, dueAt: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model('CareTask', schema);
