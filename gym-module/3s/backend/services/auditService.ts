import { Types, type ClientSession } from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import type { AuthenticatedUser } from '../types/express.js';

interface AuditInput {
  actor: AuthenticatedUser;
  action: string;
  resourceType: string;
  resourceId: string;
  customerId?: string | Types.ObjectId;
  metadata?: Record<string, unknown>;
}

const allowedMetadataKeys = new Set(['fromPtId', 'toPtId', 'version', 'reasonCode', 'credits', 'amountVnd', 'gateway', 'taskType', 'billingShortfall']);
function sanitizeMetadata(metadata?: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(metadata || {}).filter(([key, value]) => allowedMetadataKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value)));
}

async function recordAudit(input: AuditInput, session?: ClientSession) {
  const [audit] = await AuditLog.create([{
    actorId: new Types.ObjectId(input.actor.id),
    actorRole: input.actor.role,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    customerId: input.customerId ? new Types.ObjectId(String(input.customerId)) : undefined,
    metadata: sanitizeMetadata(input.metadata),
  }], session ? { session } : {});
  return audit;
}

async function recordUserAudit(
  userId: string,
  input: Omit<AuditInput, 'actor'>,
  session?: ClientSession,
) {
  const user = await User.findById(userId).select({ role: 1, centerId: 1 }).session(session || null).lean();
  if (!user) return null;
  return recordAudit({ ...input, actor: { id: userId, role: user.role, centerId: user.centerId ? String(user.centerId) : undefined } }, session);
}

export { recordAudit, recordUserAudit };
