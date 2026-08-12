import { RetailOrderModel } from "./models/retail-order.model";

export type RetailScope = { companyCode: string; branchId?: string };
export type RetailBranchScope = { companyCode: string; branchId: string };

type RetailActor = {
  role?: unknown;
  companyCode?: unknown;
  branchId?: unknown;
};

type RequestedRetailScope = {
  companyCode?: unknown;
  branchId?: unknown;
};

export class RetailScopeError extends Error {
  constructor(message: string, readonly status: 400 | 403) {
    super(message);
  }
}

function normalizeCompanyCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeBranchId(value: unknown): string {
  return String(value || "").trim();
}

export function retailScopeFromActor(actor: RetailActor): RetailScope {
  const companyCode = normalizeCompanyCode(actor.companyCode);
  if (!companyCode) throw new RetailScopeError("Company scope is required", 400);
  const branchId = normalizeBranchId(actor.branchId);
  return { companyCode, ...(branchId ? { branchId } : {}) };
}

export function retailScopeFromRequest(
  actor: RetailActor,
  requested: RequestedRetailScope,
): RetailScope {
  const requestedCompanyCode = normalizeCompanyCode(requested.companyCode);
  const requestedBranchId = normalizeBranchId(requested.branchId);

  if (String(actor.role || "") === "superadmin") {
    if (!requestedCompanyCode) throw new RetailScopeError("Company scope is required", 400);
    return {
      companyCode: requestedCompanyCode,
      ...(requestedBranchId ? { branchId: requestedBranchId } : {}),
    };
  }

  const actorScope = retailScopeFromActor(actor);
  if (requestedCompanyCode && requestedCompanyCode !== actorScope.companyCode) {
    throw new RetailScopeError("Requested company scope is not allowed", 403);
  }
  if (requestedBranchId && requestedBranchId !== actorScope.branchId) {
    throw new RetailScopeError("Requested branch scope is not allowed", 403);
  }
  return actorScope;
}

export function requireRetailBranch(scope: RetailScope): RetailBranchScope {
  if (!scope.branchId) throw new RetailScopeError("Vui lòng chọn chi nhánh bán hàng.", 400);
  return { companyCode: scope.companyCode, branchId: scope.branchId };
}

type RetailSettlementRepository = {
  settle(filter: Record<string, any>, values: Record<string, any>): Promise<any | null>;
};

export function createRetailFinanceSettlementContract(repository: RetailSettlementRepository) {
  return async (event: any) => {
    const payload = event.payload || {};
    if (payload.sourceType !== "retail_order") return null;
    const settledAt = new Date(payload.settledAt);
    if (Number.isNaN(settledAt.valueOf())) throw new Error("INVALID_SETTLED_AT");
    return repository.settle({
      _id: String(payload.sourceId), companyCode: String(event.companyCode), branchId: String(event.branchId),
      financeSettlementEventId: { $ne: String(event.eventId) },
    }, {
      dueAmount: 0, paymentStatus: "paid", status: "completed", completedAt: settledAt,
      financeSettlementEventId: String(event.eventId),
    });
  };
}

export const applyFinanceReceivableSettlement = createRetailFinanceSettlementContract({
  settle: (filter, values) => RetailOrderModel.findOneAndUpdate(filter, { $set: values, $inc: { version: 1 } }, { new: true }).lean(),
});
