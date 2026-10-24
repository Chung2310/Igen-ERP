import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { AdminActionModel } from "../model/admin-action.model";
import { hashOpaque } from "../security/crypto";
import { deliverAdminActionAudit } from "./action-audit-outbox";
import type { AdminActionDefinition } from "./action-types";

interface SubscriptionActionInput { [key: string]: unknown }
interface Request<TInput extends SubscriptionActionInput> {
  definition: AdminActionDefinition;
  input: TInput;
  reason: string;
  idempotencyKey: string;
}
const pending = () => Object.assign(new Error("Kết quả thao tác đang chờ đối soát. Hãy thử lại để nhận kết quả đã lưu."), { statusCode: 503, code: "ADMIN_ACTION_PENDING" });

/** Subscription writes and their receipt commit together; retry never repeats a committed write. */
export async function executeSubscriptionAction<TInput extends SubscriptionActionInput, T>(context: { actorId: string }, request: Request<TInput>,
  handler: (input: TInput, session: ClientSession) => Promise<T>) {
  if (!request.reason?.trim()) throw new Error("A written reason is required");
  request.definition.parse(request.input);
  const requestHash = hashOpaque(JSON.stringify({ type: request.definition.type, input: request.input }));
  const actionId = randomUUID();
  const filter = { actorId: context.actorId, idempotencyKey: request.idempotencyKey };
  const auditEvent = { riskClass: request.definition.risk, reason: request.reason,
    companyCode: typeof request.input.companyCode === "string" ? request.input.companyCode : undefined,
    occurredAt: new Date() };
  try {
    const response = await AdminActionModel.db.transaction(async (session) => {
      const existing = await AdminActionModel.findOne(filter).session(session).lean();
      if (existing) {
        if (existing.requestHash !== requestHash) throw Object.assign(new Error("Idempotency key conflict"), { statusCode: 409 });
        if (existing.status === "succeeded" && existing.result) return existing.result as { actionId: string; result: T };
        if (existing.status === "failed") throw Object.assign(new Error(existing.error?.message || "Thao tác đã thất bại. Hãy tải lại dữ liệu trước khi thử lại."), { statusCode: 409, code: "ADMIN_ACTION_FAILED" });
        throw pending();
      }
      await AdminActionModel.create([{ ...filter, actionId, actionType: request.definition.type, requestHash,
        status: "reserved", auditEvent, auditPending: true }], { session });
      const result = await handler(request.input, session);
      const receipt = { actionId, result };
      await AdminActionModel.updateOne({ actionId }, { $set: { status: "succeeded", result: receipt, completedAt: new Date() } }, { session });
      return receipt;
    });
    void deliverAdminActionAudit(response.actionId).catch(() => console.warn(`[Superadmin] Audit ${response.actionId} queued for retry.`));
    return response;
  } catch (error) {
    // A commit acknowledgement may be lost; consult its durable receipt before reporting failure.
    try {
      const committed = await AdminActionModel.findOne(filter).lean();
      if (committed?.requestHash === requestHash && committed.status === "succeeded" && committed.result) {
        return committed.result as { actionId: string; result: T };
      }
    } catch { throw pending(); }
    const cause = error as { code?: string | number; statusCode?: number; name?: string; message?: string };
    const statusCode = cause.code === 11000 ? 409 : cause.name === "ValidationError" ? 400 : cause.statusCode;
    if (!statusCode || statusCode >= 500) throw pending();
    // The transaction aborted, so recording this failure cannot describe a partial subscription change.
    await AdminActionModel.updateOne(filter, { $setOnInsert: { ...filter, actionId, requestHash,
      actionType: request.definition.type, status: "failed", completedAt: new Date(), auditEvent, auditPending: true,
      error: { message: cause.message || "Subscription action failed", code: String(cause.code || statusCode) },
    } }, { upsert: true });
    void deliverAdminActionAudit(actionId).catch(() => console.warn(`[Superadmin] Failure audit ${actionId} queued for retry.`));
    throw Object.assign(error instanceof Error ? error : new Error("Không thể hoàn tất thao tác."), { statusCode });
  }
}
