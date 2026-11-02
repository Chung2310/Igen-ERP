import type { NextFunction, Request, Response } from "express";
import { resolveFinanceScopeFromRequest, requireFinanceBranch } from "../contracts";
import { ReceivableLedgerService } from "../services/receivable-ledger.service";
import { ReceivableQueryService } from "../services/receivable-query.service";
import { validateAdjustment, validateCollection, validateExtension, validateReason, validateSuspension } from "../validations/receivable.validation";

const scope = async (req: Request) => requireFinanceBranch(await resolveFinanceScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId }));

export function createReceivableController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run(async (req) => dependencies.list(await scope(req), req.query)),
    detail: run(async (req) => dependencies.detail(await scope(req), req.params.id)),
    aging: run(async (req) => dependencies.aging(await scope(req))),
    byCustomer: run(async (req) => dependencies.byCustomer(await scope(req), req.query?.customerId ? String(req.query.customerId) : undefined)),
    collect: run(async (req) => dependencies.collect(await scope(req), req.params.id, validateCollection(req.body), (req as any).user || {})),
    adjust: run(async (req) => dependencies.adjust(await scope(req), req.params.id, validateAdjustment(req.body), (req as any).user || {})),
    writeOff: run(async (req) => dependencies.writeOff(await scope(req), req.params.id, validateReason(req.body), (req as any).user || {})),
    suspend: run(async (req) => dependencies.suspend(await scope(req), req.params.id, validateSuspension(req.body), (req as any).user || {})),
    extend: run(async (req) => dependencies.extend(await scope(req), req.params.id, validateExtension(req.body), (req as any).user || {})),
    reverse: run(async (req) => dependencies.reverse(await scope(req), req.params.id, req.params.entryId, validateReason(req.body), (req as any).user || {})),
  };
}

export const receivableController = createReceivableController({
  list: ReceivableQueryService.list, detail: ReceivableQueryService.detail, aging: ReceivableQueryService.aging, byCustomer: ReceivableQueryService.byCustomer,
  collect: ReceivableLedgerService.collect, adjust: ReceivableLedgerService.adjust, writeOff: ReceivableLedgerService.writeOff,
  suspend: ReceivableLedgerService.suspend, extend: ReceivableLedgerService.extend, reverse: ReceivableLedgerService.reverse,
});
