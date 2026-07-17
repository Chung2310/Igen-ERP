import { randomUUID } from "node:crypto";
import { AdminActionModel } from "../model/admin-action.model";
import { hashOpaque } from "../security/crypto";
import { auditService } from "../service/audit.service";
import { superAdminAuthService } from "../service/super-admin-auth.service";
import { createActionExecutor } from "./action-executor";

export const executeAdminAction = createActionExecutor({
  id: () => randomUUID(), hash: hashOpaque,
  reserve: async (record: any) => {
    try { await AdminActionModel.create({ ...record, status: "reserved" }); return { fresh: true, requestHash: record.requestHash }; }
    catch (error: any) {
      if (error?.code !== 11000) throw error;
      const existing = await AdminActionModel.findOne({ actorId: record.actorId, idempotencyKey: record.idempotencyKey }).lean();
      return { fresh: false, requestHash: existing?.requestHash, result: existing?.result };
    }
  },
  complete: (actionId: string, status: string, result?: unknown, error?: Error) => AdminActionModel.updateOne({ actionId }, { $set: { status, result, error: error ? { message: error.message } : undefined, completedAt: new Date() } }),
  audit: (event: any) => auditService.record(event),
  stepUp: (sessionId: string, password: string, token: string, step: number) => superAdminAuthService.verifyStepUp(sessionId, password, token, step),
});
