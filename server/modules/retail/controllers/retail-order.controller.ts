import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { hasEffectiveRetailCapability } from "../permissions";
import { CashierShiftService } from "../services/cashier-shift.service";
import { RetailOrderService, serializeRetailOrder } from "../services/retail-order.service";
import { RetailProductService } from "../services/retail-product.service";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const retailOrderController = {
  quote: async (req: Request, res: Response) => res.json({ success: true, data: await RetailOrderService.quote(scope(req), req.body || {}) }),
  products: async (req: Request, res: Response) => res.json({ success: true, data: await RetailProductService.search(scope(req), req.query) }),
  idempotency: async (req: Request, res: Response) => res.json({ success: true, data: await RetailOrderService.idempotency(scope(req), req.params.key) }),
  list: async (req: Request, res: Response) => { const actor = (req as any).user || {}; const canSeeCost = await hasEffectiveRetailCapability(actor, "manager"); const query = { ...req.query } as any; if ((query.heldOnly === "true" || query.heldOnly === true) && !canSeeCost) query.ownerId = String(actor.id || actor.uid || ""); const data = await RetailOrderService.list(scope(req), query); res.json({ success: true, data: { ...data, items: data.items.map((order) => serializeRetailOrder(order, canSeeCost)) } }); },
  detail: async (req: Request, res: Response) => { const actor = (req as any).user || {}; const manager = await hasEffectiveRetailCapability(actor, "manager"); res.json({ success: true, data: serializeRetailOrder(await RetailOrderService.detail(scope(req), req.params.id, actor, manager), manager) }); },
  create: async (req: Request, res: Response) => res.status(201).json({ success: true, data: await RetailOrderService.createDraft(scope(req), req.body || {}, (req as any).user) }),
  update: async (req: Request, res: Response) => res.json({ success: true, data: await RetailOrderService.updateDraft(scope(req), req.params.id, req.body || {}, (req as any).user, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) }),
  confirm: async (req: Request, res: Response) => { const actor = (req as any).user || {}; res.json({ success: true, data: await RetailOrderService.confirm(scope(req), req.params.id, req.body || {}, actor, (req as any).currentShift, await hasEffectiveRetailCapability(actor, "manager")) }); },
  collect: async (req: Request, res: Response) => res.json({ success: true, data: await RetailOrderService.collect(scope(req), req.params.id, req.body || {}, (req as any).user, (req as any).currentShift) }),
  cancel: async (req: Request, res: Response) => { const retailScope = scope(req); const shift = await CashierShiftService.current(retailScope, (req as any).user); res.json({ success: true, data: await RetailOrderService.cancel(retailScope, req.params.id, req.body || {}, (req as any).user, shift || undefined, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) }); },
};
