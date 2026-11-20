import { supplyExpiryState } from "../../../shared/supply-stock";

export interface InspectionSupply {
  _id: unknown;
  code: string;
  quantity: number;
  branchId?: string;
  warehouseId?: string;
  warehouseLocation?: string;
  batchNumber?: string;
  expiryDate?: Date | string | null;
  requiresExpiry?: boolean;
  unitPrice?: number | null;
}
export interface InspectionTransaction {
  supplyId: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
}
export function inspectSupplySnapshot(
  supplies: InspectionSupply[],
  transactions: InspectionTransaction[],
  now = new Date(),
) {
  const issues: Record<string, { count: number; sampleIds: string[] }> = {};
  const report = (code: string, id: string) => {
    const entry = (issues[code] ||= { count: 0, sampleIds: [] });
    entry.count++;
    if (entry.sampleIds.length < 50) entry.sampleIds.push(id);
  };
  const byId = new Map(supplies.map((s) => [String(s._id), s]));
  const totals = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const tx of transactions) {
    if (!byId.has(tx.supplyId)) report("ORPHAN_TRANSACTION", tx.supplyId);
    if (!["in", "out"].includes(tx.type) || !Number.isSafeInteger(tx.quantity) || tx.quantity <= 0) {
      report("INVALID_TRANSACTION", tx.supplyId);
      continue;
    }
    const delta = tx.type === "in" ? tx.quantity : -tx.quantity;
    totals.set(tx.supplyId, (totals.get(tx.supplyId) || 0) + delta);
    if (tx.balanceAfter !== tx.balanceBefore + delta) report("INVALID_TRANSACTION_BALANCE", tx.supplyId);
    if (previous.has(tx.supplyId) && previous.get(tx.supplyId) !== tx.balanceBefore)
      report("BROKEN_HISTORY_CHAIN", tx.supplyId);
    previous.set(tx.supplyId, tx.balanceAfter);
  }
  for (const supply of supplies) {
    const id = String(supply._id);
    if (!supply.branchId) report("MISSING_BRANCH", id);
    if (!supply.warehouseId) report("UNMAPPED_WAREHOUSE", id);
    if (!Number.isSafeInteger(supply.quantity) || supply.quantity < 0) report("INVALID_STOCK_QUANTITY", id);
    if (supply.quantity > 0 && !supply.batchNumber) report("STOCK_WITHOUT_LOT", id);
    if (supplyExpiryState(supply.expiryDate, supply.requiresExpiry !== false, now) === "unknown")
      report("UNVERIFIED_EXPIRY", id);
    if (supply.quantity > 0 && (supply.unitPrice == null || !Number.isFinite(supply.unitPrice) || supply.unitPrice < 0))
      report("UNVERIFIED_STOCK_VALUE", id);
    if (supply.quantity !== (totals.get(id) || 0)) report("UNRECORDED_OPENING_OR_ADJUSTMENT", id);
    if (previous.has(id) && previous.get(id) !== supply.quantity) report("CURRENT_HISTORY_MISMATCH", id);
  }
  return {
    supplies: supplies.length,
    transactions: transactions.length,
    issues,
    limitations: [
      "Read-only diagnostic, not a migration approval or a physical stock count.",
      "Previously overwritten lots or automatically invented expiry dates cannot be reconstructed from current metadata.",
      "A ledger delta mismatch may be an unrecorded opening quantity; do not repair automatically.",
    ],
  };
}
