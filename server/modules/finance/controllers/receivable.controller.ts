import type { NextFunction, Request, Response } from "express";
import { financeScopeFromRequest, requireFinanceBranch } from "../contracts";
import { ReceivableLedgerService } from "../services/receivable-ledger.service";
import { ReceivableQueryService } from "../services/receivable-query.service";
import { validateAdjustment, validateCollection, validateExtension, validateReason, validateSuspension } from "../validations/receivable.validation";

const scope = (req: Request) => requireFinanceBranch(financeScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId }));

export function createReceivableController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run((req) => dependencies.list(scope(req), req.query)),
    detail: run((req) => dependencies.detail(scope(req), req.params.id)),
    aging: run((req) => dependencies.aging(scope(req))),
    byCustomer: run((req) => dependencies.byCustomer(scope(req), req.query?.customerId ? String(req.query.customerId) : undefined)),
    collect: run((req) => dependencies.collect(scope(req), req.params.id, validateCollection(req.body), (req as any).user || {})),
    adjust: run((req) => dependencies.adjust(scope(req), req.params.id, validateAdjustment(req.body), (req as any).user || {})),
    writeOff: run((req) => dependencies.writeOff(scope(req), req.params.id, validateReason(req.body), (req as any).user || {})),
    suspend: run((req) => dependencies.suspend(scope(req), req.params.id, validateSuspension(req.body), (req as any).user || {})),
    extend: run((req) => dependencies.extend(scope(req), req.params.id, validateExtension(req.body), (req as any).user || {})),
    reverse: run((req) => dependencies.reverse(scope(req), req.params.id, req.params.entryId, validateReason(req.body), (req as any).user || {})),
  };
}

export const receivableController = createReceivableController({
  list: ReceivableQueryService.list, detail: ReceivableQueryService.detail, aging: ReceivableQueryService.aging, byCustomer: ReceivableQueryService.byCustomer,
  collect: ReceivableLedgerService.collect, adjust: ReceivableLedgerService.adjust, writeOff: ReceivableLedgerService.writeOff,
  suspend: ReceivableLedgerService.suspend, extend: ReceivableLedgerService.extend, reverse: ReceivableLedgerService.reverse,
});
