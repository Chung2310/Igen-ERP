import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface IKnowledgeDocument { title: string; topic: string; content: string; version: number; status: 'DRAFT' | 'PUBLISHED'; approvedById?: mongoose.Types.ObjectId; effectiveAt?: Date; publishedAt?: Date }
const schema = new Schema<IKnowledgeDocument>({
  title: { type: String, required: true, trim: true, index: true }, topic: { type: String, required: true, index: true }, content: { type: String, required: true },
  version: { type: Number, default: 1 }, status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  approvedById: { type: Schema.Types.ObjectId, ref: 'User' }, effectiveAt: Date, publishedAt: Date,
}, { timestamps: true });
schema.index({ title: 'text', content: 'text', topic: 'text' });schema.plugin(centerTenantPlugin);


export default mongoose.model<IKnowledgeDocument>('KnowledgeDocument', schema);
