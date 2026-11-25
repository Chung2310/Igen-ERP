/** Normalize only the envelopes of reviewed modules; presentation still uses public allowlists. */
export function normalizeBusinessResult(module: string, actionId: string, result: any): any {
  if (module === "architect-assistant") return { data: result.projects ?? result.project ?? result };
  if (module === "legal-reference") {
    if (actionId === "legal.review.list") return { data: (result.tasks || []).map((task: any) => ({
      id: task.id, title: task.document?.title, symbol: task.document?.symbol, taskType: task.taskType, reason: task.reason, createdAt: task.createdAt,
    })) };
    // A health response uses documents as a numeric count, not a collection.
    return { data: Array.isArray(result.documents) ? result.documents : Array.isArray(result.matches) ? result.matches : result };
  }
  if (actionId === "omni.contract.providers.list") return { data: (Array.isArray(result.data) ? result.data : []).map((provider: string) => ({ name: provider })) };
  return result;
}
