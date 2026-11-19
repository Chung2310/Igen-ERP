import mongoose, { Schema } from 'mongoose';
import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';

export interface IMuscleGroup {
  name: string;
  isDefault?: boolean;
  order?: number;
}

const schema = new Schema<IMuscleGroup>({
  name: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ centerId: 1, name: 1 }, { name: 'unique_muscle_group_name_per_center', unique: true });
schema.plugin(centerTenantPlugin);

export default mongoose.model<IMuscleGroup>('MuscleGroup', schema);
