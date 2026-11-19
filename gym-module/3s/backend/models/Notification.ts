import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface INotification { userId: mongoose.Types.ObjectId; type: string; title: string; message: string; resourceType: string; resourceId: string; readAt: Date | null }
const schema = new Schema<INotification>({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, type: { type: String, required: true, index: true }, title: { type: String, required: true }, message: { type: String, required: true }, resourceType: { type: String, required: true }, resourceId: { type: String, required: true }, readAt: { type: Date, default: null } }, { timestamps: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, type: 1, resourceType: 1, resourceId: 1 }, { unique: true });schema.plugin(centerTenantPlugin);


export default mongoose.model<INotification>('Notification', schema);
