import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailAfterSaleService } from "../services/retail-after-sale.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
const sendError = (res: Response, error: any) => res.status(error.status || 400).json({ success: false, error: error.message, code: error.code });
export const retailAfterSaleController = {
  revoke: async (req: Request, res: Response) => { try { res.json({ success: true, data: await RetailAfterSaleService.revoke(scope(req), req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) }); } catch (e) { sendError(res, e); } },
  reconcile: async (req: Request, res: Response) => { try { res.json({ success: true, data: await RetailAfterSaleService.reconcile(scope(req), req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) }); } catch (e) { sendError(res, e); } },
  detail: async (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: await RetailAfterSaleService.get(scope(req), req.params.id) });
    } catch (e) {
      sendError(res, e);
    }
  },
  list: async (req: Request, res: Response) => { try { res.json({ success: true, data: await RetailAfterSaleService.list(scope(req), req.query) }); } catch (e) { sendError(res, e); } },
  create: async (req: Request, res: Response) => { try { res.status(201).json({ success: true, data: await RetailAfterSaleService.create(scope(req), req.body || {}, (req as any).user, req.body?.cashSessionId ? { _id: req.body.cashSessionId } : undefined) }); } catch (e) { sendError(res, e); } },
};
