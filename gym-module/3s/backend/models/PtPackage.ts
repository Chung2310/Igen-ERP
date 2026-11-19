import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
export interface IPtPackage {
  customerId: mongoose.Types.ObjectId; name: string; totalSessions: number; usedSessions: number;
  remainingSessions: number; startDate: Date; endDate: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
}
const ptPackageSchema = new mongoose.Schema<IPtPackage>({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  name: { type: String, required: true, trim: true },
  totalSessions: { type: Number, required: true, min: 1 },
  usedSessions: { type: Number, min: 0, default: 0 },
  remainingSessions: { type: Number, min: 0, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE', index: true },
}, { timestamps: true });ptPackageSchema.plugin(centerTenantPlugin);



export default mongoose.model<IPtPackage>('PtPackage', ptPackageSchema);
