import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, required: true }, referenceId: { type: Schema.Types.ObjectId }, note: { type: String, required: true },
}, { timestamps: true });schema.plugin(centerTenantPlugin);


export default mongoose.model('CareLog', schema);
