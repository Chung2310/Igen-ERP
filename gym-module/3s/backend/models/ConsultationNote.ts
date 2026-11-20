import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IConsultationNote {
  customerId: Types.ObjectId;
  ptId: Types.ObjectId;
  consultationDate: Date;
  topic: string;
  currentCondition: string;
  advice: string;
  actionPlan?: string;
  notes?: string;
}

export type ConsultationNoteDocument = Document & IConsultationNote;

const consultationNoteSchema = new Schema<IConsultationNote>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
    ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    consultationDate: { type: Date, required: true, default: Date.now, index: true },
    topic: { type: String, required: true, trim: true },
    currentCondition: { type: String, required: true, trim: true },
    advice: { type: String, required: true, trim: true },
    actionPlan: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

consultationNoteSchema.index({ customerId: 1, consultationDate: -1 });consultationNoteSchema.plugin(centerTenantPlugin);



export default mongoose.model<IConsultationNote>('ConsultationNote', consultationNoteSchema);
