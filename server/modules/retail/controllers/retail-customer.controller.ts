import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailCustomerService } from "../services/retail-customer.service";

const scope = (req: Request) => retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });
export const retailCustomerController = {
  list: async (req: Request, res: Response) => res.json({ success: true, data: await RetailCustomerService.list(scope(req), req.query) }),
  create: async (req: Request, res: Response) => res.status(201).json({ success: true, data: await RetailCustomerService.create(requireRetailBranch(scope(req)), req.body || {}, (req as any).user || {}) }),
  detail: async (req: Request, res: Response) => res.json({ success: true, data: await RetailCustomerService.detail(scope(req), req.params.id, String(req.query.transactionBranchId || "").trim() || undefined) }),
  update: async (req: Request, res: Response) => res.json({ success: true, data: await RetailCustomerService.update(scope(req), req.params.id, req.body || {}) }),
};
