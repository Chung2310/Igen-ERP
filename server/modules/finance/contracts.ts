export type FinanceScope = { companyCode: string; branchId?: string };
export type FinanceBranchScope = { companyCode: string; branchId: string };
type FinanceActor = { role?: unknown; companyCode?: unknown; branchId?: unknown };
type RequestedFinanceScope = { companyCode?: unknown; branchId?: unknown };

export class FinanceScopeError extends Error { constructor(message: string, readonly status: 400 | 403) { super(message); } }
const company = (value: unknown) => String(value || "").trim().toUpperCase();
const branch = (value: unknown) => String(value || "").trim();

export function financeScopeFromRequest(actor: FinanceActor, requested: RequestedFinanceScope): FinanceScope {
  const requestedCompany = company(requested.companyCode), requestedBranch = branch(requested.branchId);
  if (String(actor.role || "") === "superadmin") {
    if (!requestedCompany) throw new FinanceScopeError("Company scope is required", 400);
    return { companyCode: requestedCompany, ...(requestedBranch ? { branchId: requestedBranch } : {}) };
  }
  const actorCompany = company(actor.companyCode), actorBranch = branch(actor.branchId);
  if (!actorCompany) throw new FinanceScopeError("Company scope is required", 400);
  if (requestedCompany && requestedCompany !== actorCompany) throw new FinanceScopeError("Requested company scope is not allowed", 403);
  if (requestedBranch && requestedBranch !== actorBranch) throw new FinanceScopeError("Requested branch scope is not allowed", 403);
  return { companyCode: actorCompany, ...(actorBranch ? { branchId: actorBranch } : {}) };
}

export function requireFinanceBranch(scope: FinanceScope): FinanceBranchScope {
  if (!scope.branchId) throw new FinanceScopeError("Vui lòng chọn chi nhánh tài chính.", 400);
  return { companyCode: scope.companyCode, branchId: scope.branchId };
}
