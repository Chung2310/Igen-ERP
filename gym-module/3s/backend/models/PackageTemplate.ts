import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Document, Types } from 'mongoose';

export interface IPackageTemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  totalSessions: number;
  durationDays: number;
  price?: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const packageTemplateSchema = new mongoose.Schema<IPackageTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    totalSessions: {
      type: Number,
      required: true,
      min: 1,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

packageTemplateSchema.index({ name: 'text', description: 'text' });packageTemplateSchema.plugin(centerTenantPlugin);



export default mongoose.model<IPackageTemplate>('PackageTemplate', packageTemplateSchema);
