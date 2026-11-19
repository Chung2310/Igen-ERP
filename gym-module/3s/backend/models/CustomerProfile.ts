import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
export interface ICustomerProfile {
  userId?: mongoose.Types.ObjectId | null; assignedPtId: mongoose.Types.ObjectId;
  fullName: string; phone: string; email?: string | null; dateOfBirth?: Date | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER'; height?: number | null; initialWeight?: number | null;
  medicalNotes: string; initialGoal: string; internalNotes: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LEAD';
}
const customerProfileSchema = new mongoose.Schema<ICustomerProfile>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  assignedPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fullName: { type: String, required: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true, default: null },
  dateOfBirth: { type: Date, default: null },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], default: 'OTHER' },
  height: { type: Number, min: 0, default: null },
  initialWeight: { type: Number, min: 0, default: null },
  medicalNotes: { type: String, trim: true, default: '' },
  initialGoal: { type: String, trim: true, default: '' },
  internalNotes: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'LEAD'], default: 'ACTIVE', index: true },
}, { timestamps: true });

customerProfileSchema.index({ assignedPtId: 1, status: 1, createdAt: -1 });
customerProfileSchema.index(
  { centerId: 1, email: 1 },
  { name: 'unique_customer_email_per_center', unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
customerProfileSchema.plugin(centerTenantPlugin);



const CustomerProfile = mongoose.model<ICustomerProfile>('CustomerProfile', customerProfileSchema);
export type CustomerProfileDocument = mongoose.HydratedDocument<ICustomerProfile>;
export default CustomerProfile;
