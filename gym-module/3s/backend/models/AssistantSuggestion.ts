import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface IAssistantSuggestion { customerId?: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; requestType: string; scenario: string; content: string; editedContent?: string; citations: Array<{ documentId: string; title: string }>; customerContextFields: string[]; safetyWarnings: string[]; reviewStatus: 'PT_REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED'; reviewedAt?: Date; appliedAt: Date | null }
const schema = new Schema<IAssistantSuggestion>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', index: true }, ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestType: { type: String, required: true }, scenario: { type: String, required: true }, content: { type: String, required: true }, editedContent: String,
  citations: { type: [{ documentId: { type: String, required: true }, title: { type: String, required: true } }], default: [] }, customerContextFields: { type: [String], default: [] }, safetyWarnings: { type: [String], default: [] },
  reviewStatus: { type: String, enum: ['PT_REVIEW_REQUIRED', 'APPROVED', 'REJECTED'], default: 'PT_REVIEW_REQUIRED', index: true }, reviewedAt: Date, appliedAt: { type: Date, default: null },
}, { timestamps: true });schema.plugin(centerTenantPlugin);


export default mongoose.model<IAssistantSuggestion>('AssistantSuggestion', schema);
