import type { Request, Response } from "express";
import { retailScopeFromRequest } from "../contracts";
import { lookupWarranty, listExpiringWarranty, listWarrantyGapRisk, updateWarranty } from "../services/warranty-lookup.service";

export const retailWarrantyController = {
  lookup: async (req: Request, res: Response) => {
    const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });
    res.json({ success: true, data: await lookupWarranty(scope, req.params.code) });
  },
  expiring: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await listExpiringWarranty(scope, String(req.query.scope || "customer") as any, Number(req.query.days || 30)) }); },
  gapRisk: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await listWarrantyGapRisk(scope) }); },
  update: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); const user = (req as any).user || {}; res.json({ success: true, data: await updateWarranty(scope, req.params.id, req.body || {}, { id: String(user.id || user.uid || ""), name: String(user.email || user.displayName || "") }) }); },
};
