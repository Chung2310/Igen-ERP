export type WorkerScope = { companyCode: string; branchId?: string };

export function workerScopeFromActor(actor: { companyCode?: unknown; branchId?: unknown }): WorkerScope {
  const companyCode = String(actor.companyCode || "").trim().toUpperCase();
  if (!companyCode) throw new Error("Company scope is required");
  const branchId = String(actor.branchId || "").trim();
  return { companyCode, ...(branchId ? { branchId } : {}) };
}
