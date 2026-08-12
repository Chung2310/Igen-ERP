import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailInvoiceService } from "../services/retail-invoice.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const retailInvoiceController = {
  list: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.list(scope(req), req.query) }),
  detail: async (req: Request, res: Response) => res.json({ success: true, data: await RetailInvoiceService.detail(scope(req), req.params.id) }),
};
