import type { Request, Response } from "express";
import { retailScopeFromRequest } from "../contracts";
import { lookupWarranty, listExpiringWarranty, listWarrantyGapRisk, updateWarranty } from "../services/warranty-lookup.service";
import { getEffectivePermissions } from "../../../middleware/auth";

export const retailWarrantyController = {
  lookup: async (req: Request, res: Response) => {
    const user = (req as any).user || {};
    const scope = retailScopeFromRequest(user, { companyCode: req.query.companyCode, branchId: req.query.branchId });
    const result = await lookupWarranty(scope, req.params.code);
    const permissions = await getEffectivePermissions(String(user.id || ""), String(user.role || ""), String(user.companyCode || ""));
    const posOnly = permissions.has("pos:manage") && !permissions.has("retail:read") && !permissions.has("retail:manage") && !permissions.has("*");
    if (!posOnly || !result.found) return res.json({ success: true, data: result });
    const { supplierId: _supplierId, supplierName: _supplierName, ...supplierWarranty } = result.supplierWarranty || {};
    const { orderId: _orderId, branchId: _branchId, customerId: _customerId, customerCode: _customerCode, customerName: _customerName, customerPhone: _customerPhone, ...sold } = result.sold || {};
    res.json({ success: true, data: { ...result, sold: result.sold ? sold : undefined, supplierWarranty } });
  },
  expiring: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await listExpiringWarranty(scope, String(req.query.scope || "customer") as any, Number(req.query.days || 30)) }); },
  gapRisk: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await listWarrantyGapRisk(scope) }); },
  update: async (req: Request, res: Response) => { const scope = retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); const user = (req as any).user || {}; res.json({ success: true, data: await updateWarranty(scope, req.params.id, req.body || {}, { id: String(user.id || user.uid || ""), name: String(user.email || user.displayName || "") }) }); },
};
