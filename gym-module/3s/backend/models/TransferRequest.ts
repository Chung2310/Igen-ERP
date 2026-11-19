import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';
export type TransferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ADMIN_FORCED';
export interface ITransferRequest {
  customerId: mongoose.Types.ObjectId; fromPtId: mongoose.Types.ObjectId; fromPtName: string;
  toPtId: mongoose.Types.ObjectId; toPtName: string; reason: string; status: TransferStatus;
  resolvedById?: mongoose.Types.ObjectId | null; resolvedByName: string; resolvedAt?: Date | null;
}
const transferRequestSchema = new mongoose.Schema<ITransferRequest>({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  fromPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromPtName: { type: String, trim: true, default: '' },
  toPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  toPtName: { type: String, trim: true, default: '' },
  reason: { type: String, required: true, trim: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'ADMIN_FORCED'], default: 'PENDING', index: true },
  resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedByName: { type: String, trim: true, default: '' },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

transferRequestSchema.index(
  { customerId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);transferRequestSchema.plugin(centerTenantPlugin);



export default mongoose.model<ITransferRequest>('TransferRequest', transferRequestSchema);
