import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface IProgressReport { customerId: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; periodStart: Date; periodEnd: Date; summary: string; metrics: Record<string, number | null | undefined>; sourceVersions: Record<string, unknown>; warnings: string[]; generatorVersion?: number; status: 'DRAFT' | 'PUBLISHED'; version: number; publishedAt: Date | null }
const schema = new Schema<IProgressReport>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  periodStart: { type: Date, required: true }, periodEnd: { type: Date, required: true }, summary: { type: String, required: true }, metrics: { type: Schema.Types.Mixed, default: {} }, sourceVersions: { type: Schema.Types.Mixed, default: {} }, warnings: { type: [String], default: [] }, generatorVersion: { type: Number, default: null },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true }, version: { type: Number, default: 1 }, publishedAt: { type: Date, default: null },
}, { timestamps: true });schema.plugin(centerTenantPlugin);


export default mongoose.model<IProgressReport>('ProgressReport', schema);
