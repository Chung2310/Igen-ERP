import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
export interface ICalendarEvent { ownerPtId: mongoose.Types.ObjectId; customerId?: mongoose.Types.ObjectId; title: string; startsAt: Date; endsAt: Date; notes: string; status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' }
const schema = new Schema<ICalendarEvent>({ ownerPtId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', index: true }, title: { type: String, required: true }, startsAt: { type: Date, required: true, index: true }, endsAt: { type: Date, required: true }, notes: { type: String, default: '' }, status: { type: String, enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'], default: 'SCHEDULED', index: true } }, { timestamps: true });
schema.index({ ownerPtId: 1, status: 1, startsAt: 1 });schema.plugin(centerTenantPlugin);


export default mongoose.model<ICalendarEvent>('CalendarEvent', schema);
