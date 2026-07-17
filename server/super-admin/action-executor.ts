import type { AdminActionDefinition } from "./action-types";

export function createActionExecutor(deps: any) {
  return async function execute(context: any, request: { definition: AdminActionDefinition<any>; input: unknown; idempotencyKey: string; reason?: string; password?: string; token?: string; step?: number }, handler: (input: any) => Promise<any>) {
    const { definition } = request; if (definition.requiresReason && !request.reason?.trim()) throw new Error("A written reason is required");
    const parsed = definition.parse(request.input); const requestHash = deps.hash(JSON.stringify({ type: definition.type, input: parsed })); const actionId = deps.id();
    const reservation = await deps.reserve({ actionId, actorId: context.actorId, idempotencyKey: request.idempotencyKey, actionType: definition.type, requestHash });
    if (!reservation.fresh) { if (reservation.requestHash !== requestHash) throw new Error("Idempotency key conflict"); return reservation.result; }
    if (definition.requiresStepUp) await deps.stepUp(context.sessionId, request.password, request.token, request.step, definition.type, actionId);
    try { const result = await handler(parsed); const envelope = { ...(result && typeof result === "object" ? result : { result }), actionId }; await deps.complete(actionId, "succeeded", envelope); await deps.audit({ actionId, actionType: definition.type, riskClass: definition.risk, result: "success", reason: request.reason }); return envelope; }
    catch (error) { await deps.complete(actionId, "failed", undefined, error); await deps.audit({ actionId, actionType: definition.type, riskClass: definition.risk, result: "failure", reason: request.reason }); throw error; }
  };
}
