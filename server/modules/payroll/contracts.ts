export type PayrollScope = { companyCode: string; branchId: string };
type PayrollActor = { companyCode?: unknown; branchId?: unknown };

export class PayrollScopeError extends Error {
  constructor(message: string, readonly status: 400 = 400) {
    super(message);
  }
}

const company = (value: unknown) => String(value || "").trim();
const branch = (value: unknown) => String(value || "").trim();

export function payrollScopeFromActor(actor: PayrollActor): PayrollScope | null {
  const companyCode = company(actor.companyCode);
  const branchId = branch(actor.branchId);
  return companyCode && branchId ? { companyCode, branchId } : null;
}

export function requirePayrollScope(actor: PayrollActor): PayrollScope {
  const scope = payrollScopeFromActor(actor);
  if (!scope) throw new PayrollScopeError("Authenticated company and branch are required");
  return scope;
}
