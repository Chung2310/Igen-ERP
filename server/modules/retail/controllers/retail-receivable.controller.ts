import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailReceivableLedgerService } from "../services/retail-receivable-ledger.service";
import { RetailReceivableQueryService } from "../services/retail-receivable-query.service";
import { RetailReceivableReconciliationService } from "../services/retail-receivable-reconciliation.service";

const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
type Dependencies = { history: typeof RetailReceivableQueryService.history; adjust: typeof RetailReceivableLedgerService.adjust; reverse: typeof RetailReceivableLedgerService.reverse; reconcile?: typeof RetailReceivableReconciliationService.run; latestReconciliation?: typeof RetailReceivableReconciliationService.latest };

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

export const retailReceivableController = createRetailReceivableController({ history: RetailReceivableQueryService.history, adjust: RetailReceivableLedgerService.adjust, reverse: RetailReceivableLedgerService.reverse, reconcile: RetailReceivableReconciliationService.run, latestReconciliation: RetailReceivableReconciliationService.latest });
