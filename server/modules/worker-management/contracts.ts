export type WorkerScope = { companyCode: string; branchId?: string };

type WorkerActor = {
  role?: unknown;
  companyCode?: unknown;
  branchId?: unknown;
};

type RequestedWorkerScope = {
  companyCode?: unknown;
  branchId?: unknown;
};

export class WorkerScopeError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

function normalizeCompanyCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeBranchId(value: unknown) {
  return String(value || "").trim();
}

export function workerScopeFromActor(actor: WorkerActor): WorkerScope {
  const companyCode = normalizeCompanyCode(actor.companyCode);
  if (!companyCode) throw new Error("Company scope is required");
  const branchId = normalizeBranchId(actor.branchId);
  return { companyCode, ...(branchId ? { branchId } : {}) };
}

export function workerScopeFromRequest(
  actor: WorkerActor,
  requested: RequestedWorkerScope,
): WorkerScope {
  const requestedCompanyCode = normalizeCompanyCode(requested.companyCode);
  const requestedBranchId = normalizeBranchId(requested.branchId);

  if (String(actor.role || "") === "superadmin") {
    if (!requestedCompanyCode) {
      throw new WorkerScopeError("Company scope is required", 400);
    }
    return {
      companyCode: requestedCompanyCode,
      ...(requestedBranchId ? { branchId: requestedBranchId } : {}),
    };
  }

  const actorScope = workerScopeFromActor(actor);
  if (
    requestedCompanyCode &&
    requestedCompanyCode !== actorScope.companyCode
  ) {
    throw new WorkerScopeError(
      "Requested company scope is not allowed",
      403,
    );
  }
  if (
    requestedBranchId &&
    requestedBranchId !== actorScope.branchId
  ) {
    throw new WorkerScopeError(
      "Requested branch scope is not allowed",
      403,
    );
  }
  return actorScope;
}
