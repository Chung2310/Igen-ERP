import { apiFetch } from '../modules/shared/lib/apiFetch';

export type ReconciliationScope = { companyCode: string; branchId: string };
export type InventoryFinding = { code: string; severity: 'error' | 'review'; branchId?: string; warehouseId?: string; sku?: string; documentId?: string; message: string; details?: Record<string, unknown> };
export type InventoryAuditResult = {
  summary: { complete: boolean; status: 'issues' | 'needs-review' | 'clean'; errors: number; reviews: number; findings: number; examined: Record<string, number>; baselineMode: string; scope: ReconciliationScope & { warehouseId?: string }; snapshotTime: string };
  findings: InventoryFinding[]; truncated: boolean; checkedAt: string;
};
export type AuditWarehouse = { _id: string; name: string; code: string; kind: string; isActive: boolean };

export const inventoryReconciliationService = {
  async warehouses(scope: ReconciliationScope, signal?: AbortSignal) {
    return (await apiFetch<{ data: AuditWarehouse[] }>('/inventory/reconciliation/warehouses', { params: scope, signal })).data;
  },
  async run(scope: ReconciliationScope, input: { warehouseId?: string; baseline?: unknown; ledgerComplete?: boolean }, signal?: AbortSignal) {
    return (await apiFetch<{ data: InventoryAuditResult }>('/inventory/reconciliation/runs', { method: 'POST', params: scope, body: JSON.stringify(input), signal })).data;
  },
};
