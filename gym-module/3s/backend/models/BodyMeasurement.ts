import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface CircumferenceMeasurements { [key: string]: number | undefined; chest?: number; waist?: number; hips?: number; arm?: number; thigh?: number; calf?: number }
export interface IBodyMeasurement { customerId: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; measuredAt: Date; weight?: number; bodyFatPercentage?: number; muscleMass?: number; measurements: CircumferenceMeasurements }
const schema = new Schema<IBodyMeasurement>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  measuredAt: { type: Date, required: true, index: true }, weight: { type: Number, min: 0 }, bodyFatPercentage: { type: Number, min: 0, max: 100 },
  muscleMass: { type: Number, min: 0 }, measurements: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ customerId: 1, measuredAt: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model<IBodyMeasurement>('BodyMeasurement', schema);
