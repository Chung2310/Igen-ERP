import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';
import type { UserRole } from './User.js';

export interface IAuditLog {
  actorId: mongoose.Types.ObjectId;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  customerId?: mongoose.Types.ObjectId;
  metadata: Record<string, unknown>;
}

const auditLogSchema = new Schema<IAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorRole: { type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'PT', 'CUSTOMER'], required: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: String, required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });auditLogSchema.plugin(centerTenantPlugin);



export default mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
