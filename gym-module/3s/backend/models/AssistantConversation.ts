import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
const schema = new Schema({ customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, title: { type: String, required: true }, messages: { type: [Schema.Types.Mixed], default: [] } }, { timestamps: true });schema.plugin(centerTenantPlugin);


export default mongoose.model('AssistantConversation', schema);
