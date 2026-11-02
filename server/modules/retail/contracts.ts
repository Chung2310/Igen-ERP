import { RetailOrderModel } from "./models/retail-order.model";
import { SerialUnitModel } from "../inventory/serials/serial-unit.model";
import { snapshotCoverage } from "../inventory/serials/warranty-clock";
import { BranchModel } from "../../model/branch.model";

export type RetailScope = { companyCode: string; branchId?: string };
export type RetailBranchScope = { companyCode: string; branchId: string };

import { getCustomerContact } from "../customer-management/contracts";

export async function lookupSoldDevice(scope: RetailScope, code: string, at = new Date()) {
  const normalized = String(code || "").trim().toUpperCase();
  const unit: any = await SerialUnitModel.findOne({ companyCode: scope.companyCode, status: "sold", $or: [{ normalizedSerialNumber: normalized }, { normalizedInternalBarcode: normalized }, { normalizedBarcodeAliases: normalized }, { normalizedImeis: normalized }] }).lean();
  if (!unit) return { found: false as const };
  const customer = unit.customerId ? await getCustomerContact({ companyCode: scope.companyCode }, String(unit.customerId), { includeInactive: true }).catch(() => null) : null;
  const isHex = (id?: unknown) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id.trim());
  const friendlyCustId = customer?.customerCode || (unit.customerId && !isHex(unit.customerId) ? String(unit.customerId) : undefined);
  return {
    found: true as const,
    serialUnit: unit,
    coverage: snapshotCoverage(unit, at),
    sold: {
      soldAt: unit.soldAt,
      orderId: unit.soldOrderId,
      orderCode: unit.soldOrderCode,
      branchId: unit.soldBranchId,
      customerId: friendlyCustId || (customer?.phone ? `KH-${customer.phone}` : String(unit.customerId || "")),
      customerCode: customer?.customerCode,
      customerName: customer?.name,
      customerPhone: customer?.phone,
    }
  };
}

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

type RetailBranchLookup = { exists(filter: { _id: string; companyCode: string; isActive: boolean }): Promise<unknown> };

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
  const isCompanyAdmin = String(actor.role || "") === "admin";
  if (requestedBranchId && requestedBranchId !== actorScope.branchId && !isCompanyAdmin) {
    throw new RetailScopeError("Requested branch scope is not allowed", 403);
  }
  const branchId = requestedBranchId && isCompanyAdmin ? requestedBranchId : actorScope.branchId;
  return { companyCode: actorScope.companyCode, ...(branchId ? { branchId } : {}) };
}

export async function resolveRetailScopeFromRequest(
  actor: RetailActor,
  requested: RequestedRetailScope,
  branchLookup: RetailBranchLookup = BranchModel as unknown as RetailBranchLookup,
): Promise<RetailScope> {
  const requestedBranchId = normalizeBranchId(requested.branchId);
  const role = String(actor.role || "");
  const scope = retailScopeFromRequest(actor, requested);

  if (requestedBranchId && (role === "admin" || role === "superadmin")) {
    if (!/^[a-f0-9]{24}$/i.test(requestedBranchId)) throw new RetailScopeError("Selected branch is invalid", 400);
    if (!await branchLookup.exists({ _id: requestedBranchId, companyCode: scope.companyCode, isActive: true })) {
      throw new RetailScopeError("Selected branch does not belong to this company", 403);
    }
  }
  return scope;
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
  settle: (filter, values) => RetailOrderModel.findOneAndUpdate(filter, { $set: values, $inc: { version: 1 } }, { returnDocument: 'after' }).lean(),
});
