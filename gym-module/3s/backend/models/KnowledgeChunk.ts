import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeDocument', required: true, index: true }, documentVersion: { type: Number, required: true },
  topic: { type: String, required: true, index: true }, position: { type: Number, required: true }, content: { type: String, required: true }, embedding: { type: [Number], default: [] },
}, { timestamps: true });
schema.index({ content: 'text', topic: 'text' });
schema.index({ documentId: 1, documentVersion: 1, position: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model('KnowledgeChunk', schema);
