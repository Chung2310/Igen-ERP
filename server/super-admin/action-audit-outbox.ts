import { AdminActionModel } from "../model/admin-action.model";
import { AuditEventModel, type AuditEventInsert } from "../model/audit-event.model";
import { auditService } from "../service/audit.service";

/** Stable event IDs make delivery safe after a lost acknowledgement or concurrent retries. */
export async function deliverAdminActionAudit(actionId: string): Promise<void> {
  const action = await AdminActionModel.findOne({ actionId, auditPending: true, status: { $in: ["succeeded", "failed"] } }).lean();
  if (!action?.auditEvent) return;
  const eventId = `admin-action:${actionId}`;
  try {
    try {
      await auditService.record({ ...action.auditEvent, eventId, actionId, actorSuperAdminId: action.actorId,
        actionType: action.actionType, result: action.status === "succeeded" ? "success" : "failure" } as AuditEventInsert);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000 || !await AuditEventModel.findOne({ eventId })) throw error;
    }
    await AdminActionModel.updateOne({ actionId }, { $set: { auditPending: false }, $unset: { auditLastError: 1, auditNextAttemptAt: 1 } });
  } catch {
    const delay = Math.min(15 * 60_000, 5_000 * 2 ** Math.min(action.auditAttempts || 0, 8));
    await AdminActionModel.updateOne({ actionId }, { $inc: { auditAttempts: 1 }, $set: {
      auditPending: true, auditNextAttemptAt: new Date(Date.now() + delay), auditLastError: "Audit delivery pending retry",
    } });
    throw new Error(`Audit delivery pending for action ${actionId}`);
  }
}

export async function recoverAdminActionAudits(): Promise<void> {
  const pending = await AdminActionModel.find({ auditPending: true, status: { $in: ["succeeded", "failed"] },
    $or: [{ auditNextAttemptAt: { $exists: false } }, { auditNextAttemptAt: { $lte: new Date() } }],
  }).select("actionId").sort({ createdAt: 1 }).limit(50).lean();
  for (const action of pending) {
    try { await deliverAdminActionAudit(action.actionId); }
    catch { /* The durable record retains the next retry time. */ }
  }
}
