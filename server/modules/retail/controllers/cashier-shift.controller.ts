import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { CashierShiftService, serializeCashierShift } from "../services/cashier-shift.service";
import { hasEffectiveRetailCapability } from "../permissions";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
export const cashierShiftController = {
  current: async (req: Request, res: Response) => { const shift = await CashierShiftService.current(scope(req), (req as any).user); res.json({ success: true, data: shift ? serializeCashierShift(shift, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) : null }); },
  list: async (req: Request, res: Response) => { const data = await CashierShiftService.list(scope(req), req.query); const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager"); res.json({ success: true, data: { ...data, items: data.items.map((shift) => serializeCashierShift(shift, manager)) } }); },
  detail: async (req: Request, res: Response) => { const data = await CashierShiftService.detail(scope(req), req.params.id); const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager"); res.json({ success: true, data: { ...data, shift: serializeCashierShift(data.shift, manager) } }); },
  open: async (req: Request, res: Response) => res.status(201).json({ success: true, data: serializeCashierShift(await CashierShiftService.open(scope(req), req.body || {}, (req as any).user), false) }),
  movement: async (req: Request, res: Response) => res.json({ success: true, data: serializeCashierShift(await CashierShiftService.addMovement(scope(req), req.params.id, req.body || {}, (req as any).user), false) }),
  close: async (req: Request, res: Response) => res.json({ success: true, data: await CashierShiftService.close(scope(req), req.params.id, req.body || {}, (req as any).user) }),
  approve: async (req: Request, res: Response) => res.json({ success: true, data: await CashierShiftService.approve(scope(req), req.params.id, (req as any).user) }),
};
