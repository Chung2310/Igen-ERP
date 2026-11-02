import type { Request } from "express";
import { BranchModel } from "../../model/branch.model";
import { requireRetailBranch, retailScopeFromRequest } from "../retail/contracts";
import { CustomerError } from "./customer-errors";

export type CustomerScope = { companyCode: string; branchId?: string; includeLegacy?: boolean };

// Unassigned historical records belong to MAIN, never to every branch.
export function customerScopeFilter(scope: CustomerScope): Record<string, unknown> {
  return {
    companyCode: scope.companyCode,
    ...(scope.branchId ? scope.includeLegacy ? {
      $and: [{ $or: [{ branchId: scope.branchId }, { branchId: null }, { branchId: "" }] }],
    } : { branchId: scope.branchId } : {}),
  };
}

export async function customerScopeFromRequest(req: Request): Promise<CustomerScope> {
  const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
  return resolveCustomerBranchScope(scope);
}

export async function resolveCustomerBranchScope(scope: { companyCode: string; branchId: string }): Promise<CustomerScope> {
  const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).select("code").lean();
  if (!branch) throw new CustomerError("CUSTOMER_BRANCH_INVALID", "Chi nhánh không hợp lệ.", 403);
  return { ...scope, includeLegacy: branch.code === "MAIN" };
}
