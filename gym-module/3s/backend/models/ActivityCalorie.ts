import mongoose, { Schema } from 'mongoose';
import { sharedCenterCatalogPlugin } from '../tenancy/centerTenantPlugin.js';
export interface IActivityCalorie { name: string; category: string; met: number; active: boolean; centerId?: mongoose.Types.ObjectId | null }
const schema = new Schema<IActivityCalorie>({ name: { type: String, required: true, trim: true }, category: { type: String, required: true, index: true }, met: { type: Number, required: true, min: 0.1, max: 30 }, active: { type: Boolean, default: true, index: true } }, { timestamps: true });
schema.index({ centerId: 1, name: 1 }, { name: 'unique_activity_name_per_center', unique: true });
schema.plugin(sharedCenterCatalogPlugin);
export default mongoose.model<IActivityCalorie>('ActivityCalorie', schema);
