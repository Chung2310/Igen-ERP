import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailReceivableEntryModel } from "../models/retail-receivable-entry.model";
import { RetailReceivableReconciliationModel } from "../models/retail-receivable-reconciliation.model";

export interface ReconciliationDifference { orderId: string; snapshotDue: number; ledgerDue: number; difference: number }

export function validateReconciliationScope(scope: RetailBranchScope) {
  if (!String(scope.companyCode || "").trim() || !String(scope.branchId || "").trim()) throw new Error("Company and branch are required for reconciliation.");
  return scope;
}

export function compareRetailReceivableBalances(snapshotRows: Array<{ orderId: string; snapshotDue: number }>, ledgerRows: Array<{ orderId: string; ledgerDue: number }>): ReconciliationDifference[] {
  const snapshots = new Map(snapshotRows.map((row) => [String(row.orderId), Number(row.snapshotDue || 0)]));
  const ledger = new Map(ledgerRows.map((row) => [String(row.orderId), Number(row.ledgerDue || 0)]));
  return [...new Set([...snapshots.keys(), ...ledger.keys()])].sort().map((orderId) => {
    const snapshotDue = snapshots.get(orderId) || 0;
    const ledgerDue = ledger.get(orderId) || 0;
    return { orderId, snapshotDue, ledgerDue, difference: snapshotDue - ledgerDue };
  }).filter((row) => row.difference !== 0);
}

export async function reconcileRetailReceivables(scope: RetailBranchScope, actor: any) {
  validateReconciliationScope(scope);
  const [snapshotRows, ledgerRows] = await Promise.all([
    RetailOrderModel.aggregate([{ $match: { ...scope, status: { $in: ["confirmed", "completed"] }, customerId: { $type: "string" } } }, { $project: { _id: 0, orderId: { $toString: "$_id" }, snapshotDue: "$dueAmount" } }]),
    RetailReceivableEntryModel.aggregate([{ $match: { ...scope, orderId: { $type: "string" } } }, { $group: { _id: "$orderId", ledgerDue: { $sum: "$signedAmount" } } }, { $project: { _id: 0, orderId: "$_id", ledgerDue: 1 } }]),
  ]);
  const differences = compareRetailReceivableBalances(snapshotRows, ledgerRows);
  const orderTotal = snapshotRows.reduce((sum, row) => sum + Number(row.snapshotDue || 0), 0);
  const ledgerTotal = ledgerRows.reduce((sum, row) => sum + Number(row.ledgerDue || 0), 0);
  return RetailReceivableReconciliationModel.create({ ...scope, differences, orderTotal, ledgerTotal, differenceTotal: orderTotal - ledgerTotal, createdBy: String(actor.id || actor.uid || ""), createdByName: String(actor.displayName || actor.email || "") });
}

export const RetailReceivableReconciliationService = {
  run: reconcileRetailReceivables,
  latest(scope: RetailBranchScope) {
    validateReconciliationScope(scope);
    return RetailReceivableReconciliationModel.findOne(scope).sort({ createdAt: -1 }).lean();
  },
};
