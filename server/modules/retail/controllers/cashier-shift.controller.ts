import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { CashierShiftService, serializeCashierShift } from "../services/cashier-shift.service";
import { hasEffectiveRetailCapability } from "../permissions";
const scope = (req: Request) => requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));

const asyncHandler = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

export const cashierShiftController = {
  current: asyncHandler(async (req, res) => { const shift = await CashierShiftService.current(scope(req), (req as any).user); res.json({ success: true, data: shift ? serializeCashierShift(shift, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) : null }); }),
  list: asyncHandler(async (req, res) => { const data = await CashierShiftService.list(scope(req), req.query); const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager"); res.json({ success: true, data: { ...data, items: data.items.map((shift) => serializeCashierShift(shift, manager)) } }); }),
  detail: asyncHandler(async (req, res) => { const data = await CashierShiftService.detail(scope(req), req.params.id); const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager"); res.json({ success: true, data: { ...data, shift: serializeCashierShift(data.shift, manager) } }); }),
  open: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: serializeCashierShift(await CashierShiftService.open(scope(req), req.body || {}, (req as any).user), false) }); }),
  close: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.close(scope(req), req.params.id, req.body || {}, (req as any).user) }); }),
};
