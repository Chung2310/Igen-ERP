import type { AdminActionDefinition } from "./action-types";
import type { AuditEventInsert } from "../model/audit-event.model";

interface ActionReservation {
  fresh: boolean;
  requestHash?: string;
  result?: unknown;
  status?: string;
  error?: { message: string };
}
interface ActionExecutorDependencies {
  id(): string;
  hash(value: string): string;
  reserve(record: { actionId: string; actorId: string; idempotencyKey: string; actionType: string; requestHash: string; auditEvent?: Record<string, unknown>; auditPending?: boolean }): Promise<ActionReservation>;
  complete(actionId: string, status: "succeeded" | "failed", result?: unknown, error?: unknown): PromiseLike<unknown>;
  audit(event: Partial<AuditEventInsert> & Pick<AuditEventInsert, "actionType" | "actorSuperAdminId" | "result">): PromiseLike<unknown>;
  stepUp(sessionId: string, password: string, token: string, step: number, actionType: string, actionId: string): PromiseLike<unknown>;
}

function pendingAction() {
  return Object.assign(new Error("Kết quả thao tác đang chờ đối soát. Hãy tải lại dữ liệu trước khi thao tác tiếp."), { statusCode: 503, code: "ADMIN_ACTION_PENDING" });
}

export function createActionExecutor(deps: ActionExecutorDependencies) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy registered actions provide different context, payload and result shapes.
  return async function execute(context: any, request: { definition: AdminActionDefinition<any>; input: unknown; idempotencyKey: string; reason?: string; password?: string; token?: string; step?: number }, handler: (input: any) => Promise<any>) {
    const { definition } = request; if (definition.requiresReason && !request.reason?.trim()) throw new Error("A written reason is required");
    const parsed = definition.parse(request.input); const requestHash = deps.hash(JSON.stringify({ type: definition.type, input: parsed })); const actionId = deps.id();
    const fields = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const companyCode = typeof fields.companyCode === "string" ? fields.companyCode : typeof fields.code === "string" ? fields.code : undefined;
    const reservation = await deps.reserve({ actionId, actorId: context.actorId, idempotencyKey: request.idempotencyKey, actionType: definition.type, requestHash,
      auditPending: true, auditEvent: { riskClass: definition.risk, reason: request.reason, companyCode, occurredAt: new Date() } });
    if (!reservation.fresh) {
      if (reservation.requestHash !== requestHash) throw Object.assign(new Error("Idempotency key conflict"), { statusCode: 409 });
      if (reservation.result) return reservation.result;
      if (reservation.status === "failed") throw Object.assign(new Error(reservation.error?.message || "Thao tác trước đã thất bại. Hãy tải lại dữ liệu và thử lại."), { statusCode: 409, code: "ADMIN_ACTION_FAILED" });
      throw pendingAction();
    }
    const audit = async (result: "success" | "failure") => {
      try { await deps.audit({ actionId, actorSuperAdminId: context.actorId, actionType: definition.type, riskClass: definition.risk, result, reason: request.reason, companyCode }); }
      catch { console.error(`[Superadmin] Audit recording failed for action ${actionId}; the action result is preserved.`); }
    };
    let result: unknown;
    try {
      if (definition.requiresStepUp) await deps.stepUp(context.sessionId, request.password, request.token, request.step, definition.type, actionId);
      result = await handler(parsed);
    } catch (error) {
      try { await deps.complete(actionId, "failed", undefined, error); }
      catch { throw pendingAction(); }
      await audit("failure");
      throw error;
    }
    const response = { actionId, result };
    // A completed mutation must never be relabelled failed because its receipt or audit could not be saved.
    try { await deps.complete(actionId, "succeeded", response); }
    catch { throw pendingAction(); }
    await audit("success");
    return response;
  };
}
