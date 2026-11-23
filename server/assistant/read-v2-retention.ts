import type { AuthenticatedRequest } from "../middleware/auth";
import type { PendingAction } from "./service";
import type { ContextV2 } from "./read-v2-contract";
import { AssistantSessionModel, AssistantTurnModel } from "./models";
import { actorScope } from "./workflows";

/** Local prototype's lazy sweep. Never deletes turn identity, result, completed steps or conversations. */
export async function purgeExpiredReadV2Pins(req: AuthenticatedRequest, conversationId: string, pending: PendingAction | null, context?: ContextV2) {
  const scope = { ...actorScope(req), branchId: req.user?.branchId || "" };
  const now = Date.now();
  await AssistantTurnModel.updateMany({ ...scope, "readV2.retentionUntil": { $lte: now } }, { $unset: { readV2: 1 } });
  const unset: Record<string, 1> = {};
  if (context?.version === 2 && context.retentionUntil <= now) { context = undefined; unset.readV2Context = 1; }
  if (pending?.readV2?.schemaVersion === 2 && pending.readV2.retentionUntil <= now) {
    pending = structuredClone(pending);
    delete pending.resolved;
    delete pending.productReadProof;
    pending.readV2 = { ...pending.readV2!, options: [], context: { ...pending.readV2!.context, entities: [] }, provenance: [] };
    await AssistantSessionModel.updateOne({ ...scope, conversationId }, { $set: { pending } });
  }
  if (Object.keys(unset).length) await AssistantSessionModel.updateOne({ ...scope, conversationId }, { $unset: unset });
  return { pending, context };
}
