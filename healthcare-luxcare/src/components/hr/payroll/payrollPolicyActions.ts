export type PayrollPolicyAction = "edit" | "clone" | "activate" | "retire" | "delete";

export function getPayrollPolicyActions(canManage: boolean, status: string, isCurrentOrFuture = true): PayrollPolicyAction[] {
  if (!canManage) return [];
  if (status === "draft") return ["edit", "clone", "activate", "delete"];
  if (status === "active") return isCurrentOrFuture ? ["edit", "clone", "retire"] : ["edit", "clone", "activate", "retire"];
  if (status === "retired") return ["clone", "activate", "delete"];
  return [];
}
