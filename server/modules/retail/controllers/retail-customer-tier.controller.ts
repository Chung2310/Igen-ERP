import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailCustomerTierService } from "../services/retail-customer-tier-api.service";

const scope = (req: Request) => retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });

export const retailCustomerTierController = {
  tierHistory: async (req: Request, res: Response) => res.json({ success: true, data: await RetailCustomerTierService.tierHistory(requireRetailBranch(scope(req)), req.params.id) }),
  overrideTier: async (req: Request, res: Response) => res.status(201).json({ success: true, data: await RetailCustomerTierService.overrideTier(requireRetailBranch(scope(req)), req.params.id, req.body || {}, (req as any).user || {}) }),
  tierSummary: async (req: Request, res: Response) => res.json({ success: true, data: await RetailCustomerTierService.tierSummary(requireRetailBranch(scope(req)), req.query) }),
};
