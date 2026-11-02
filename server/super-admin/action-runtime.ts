import { randomUUID } from "node:crypto";
import { AdminActionModel } from "../model/admin-action.model";
import { hashOpaque } from "../security/crypto";
import { deliverAdminActionAudit } from "./action-audit-outbox";
import { superAdminAuthService } from "../service/super-admin-auth.service";
import { createActionExecutor } from "./action-executor";

export const executeAdminAction = createActionExecutor({
  id: () => randomUUID(), hash: hashOpaque,
  reserve: async (record) => {
    try { await AdminActionModel.create({ ...record, status: "reserved" }); return { fresh: true, requestHash: record.requestHash }; }
    catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const existing = await AdminActionModel.findOne({ actorId: record.actorId, idempotencyKey: record.idempotencyKey }).lean();
      return { fresh: false, requestHash: existing?.requestHash, result: existing?.result, status: existing?.status, error: existing?.error };
    }
  },
  complete: (actionId: string, status: string, result?: unknown, error?: unknown) => AdminActionModel.updateOne({ actionId }, { $set: { status, result, error: error ? { message: error instanceof Error ? error.message : String(error) } : undefined, completedAt: new Date() } }),
  audit: (event) => deliverAdminActionAudit(event.actionId!),
  stepUp: (sessionId: string, password: string, token: string, step: number) => superAdminAuthService.verifyStepUp(sessionId, password, token, step),
});
