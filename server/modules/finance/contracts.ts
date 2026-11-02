import { BranchModel } from "../../model/branch.model";

export type FinanceScope = { companyCode: string; branchId?: string };
export type FinanceBranchScope = { companyCode: string; branchId: string };
type FinanceActor = { role?: unknown; companyCode?: unknown; branchId?: unknown };
type RequestedFinanceScope = { companyCode?: unknown; branchId?: unknown };

export class FinanceScopeError extends Error { constructor(message: string, readonly status: 400 | 403) { super(message); } }
const company = (value: unknown) => String(value || "").trim().toUpperCase();
const branch = (value: unknown) => String(value || "").trim();

type BranchLookup = { exists(filter: { _id: string; companyCode: string; isActive: boolean }): Promise<unknown> };

export function financeScopeFromRequest(actor: FinanceActor, requested: RequestedFinanceScope): FinanceScope {
  const requestedCompany = company(requested.companyCode), requestedBranch = branch(requested.branchId);
  if (String(actor.role || "") === "superadmin") {
    if (!requestedCompany) throw new FinanceScopeError("Company scope is required", 400);
    return { companyCode: requestedCompany, ...(requestedBranch ? { branchId: requestedBranch } : {}) };
  }
  const actorCompany = company(actor.companyCode), actorBranch = branch(actor.branchId);
  if (!actorCompany) throw new FinanceScopeError("Company scope is required", 400);
  if (requestedCompany && requestedCompany !== actorCompany) throw new FinanceScopeError("Requested company scope is not allowed", 403);
  const isCompanyAdmin = String(actor.role || "") === "admin";
  if (requestedBranch && requestedBranch !== actorBranch && !isCompanyAdmin) throw new FinanceScopeError("Requested branch scope is not allowed", 403);
  const branchId = requestedBranch && isCompanyAdmin ? requestedBranch : actorBranch;
  return { companyCode: actorCompany, ...(branchId ? { branchId } : {}) };
}

export async function resolveFinanceScopeFromRequest(
  actor: FinanceActor,
  requested: RequestedFinanceScope,
  branchLookup: BranchLookup = BranchModel as unknown as BranchLookup,
): Promise<FinanceScope> {
  const scope = financeScopeFromRequest(actor, requested);
  const selectedBranch = branch(requested.branchId);
  if (selectedBranch && (String(actor.role || "") === "admin" || String(actor.role || "") === "superadmin")) {
    if (!/^[a-f0-9]{24}$/i.test(selectedBranch)) throw new FinanceScopeError("Selected branch is invalid", 400);
    if (!await branchLookup.exists({ _id: selectedBranch, companyCode: scope.companyCode, isActive: true })) {
      throw new FinanceScopeError("Selected branch does not belong to this company", 403);
    }
  }
  return scope;
}

export function requireFinanceBranch(scope: FinanceScope): FinanceBranchScope {
  if (!scope.branchId) throw new FinanceScopeError("Vui lòng chọn chi nhánh tài chính.", 400);
  return { companyCode: scope.companyCode, branchId: scope.branchId };
}
