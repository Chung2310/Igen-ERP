import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailReceivableLedgerService as LegacyLedger } from "../services/retail-receivable-ledger.service";
import { RetailReceivableQueryService as LegacyQuery } from "../services/retail-receivable-query.service";
import { RetailReceivableReconciliationService } from "../services/retail-receivable-reconciliation.service";
import { createFinanceRetailAdapter, FinanceRetailCompatibilityService } from "../../finance/services/finance-retail-adapter";

const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
type Dependencies = { history: typeof LegacyQuery.history; adjust: typeof LegacyLedger.adjust; reverse: typeof LegacyLedger.reverse; reconcile?: typeof RetailReceivableReconciliationService.run; latestReconciliation?: typeof RetailReceivableReconciliationService.latest };

export function createRetailReceivableController(dependencies: Dependencies) {
  const run = (handler: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    history: run((req) => dependencies.history(scope(req), req.params.customerId, req.query)),
    adjustment: run((req) => dependencies.adjust(scope(req), req.body, (req as any).user || {})),
    reversal: run((req) => dependencies.reverse(scope(req), req.params.entryId, String(req.body?.reason || ""), (req as any).user || {})),
    reconcile: run((req) => (dependencies.reconcile || RetailReceivableReconciliationService.run)(scope(req), (req as any).user || {})),
    latestReconciliation: run((req) => (dependencies.latestReconciliation || RetailReceivableReconciliationService.latest)(scope(req))),
  };
}

export const FinanceRetailCompatibilityAdapter = createFinanceRetailAdapter({
  finance: FinanceRetailCompatibilityService,
  legacy: { history: LegacyQuery.history, adjust: LegacyLedger.adjust, reverse: LegacyLedger.reverse },
});
export const retailReceivableController = createRetailReceivableController({ history: FinanceRetailCompatibilityAdapter.history, adjust: FinanceRetailCompatibilityAdapter.adjust, reverse: FinanceRetailCompatibilityAdapter.reverse, reconcile: RetailReceivableReconciliationService.run, latestReconciliation: RetailReceivableReconciliationService.latest });
