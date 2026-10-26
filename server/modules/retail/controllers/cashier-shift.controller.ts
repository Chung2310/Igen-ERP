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
  cashiers: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.cashiers(scope(req)) }); }),
  drawers: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.drawers(scope(req)) }); }),
  createDrawer: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await CashierShiftService.createDrawer(scope(req), req.body || {}) }); }),
  resume: asyncHandler(async (req, res) => { const actor = (req as any).user; res.json({ success: true, data: serializeCashierShift(await CashierShiftService.resume(scope(req), req.params.id, { ...req.body, terminalId: req.query.terminalId || req.body?.terminalId }, actor), await hasEffectiveRetailCapability(actor, "manager")) }); }),
  pause: asyncHandler(async (req, res) => { await CashierShiftService.pause(scope(req), req.params.id, { terminalId: req.query.terminalId || req.body?.terminalId }, (req as any).user); res.json({ success: true, data: null }); }),
  moveCash: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.moveCash(scope(req), req.params.id, req.body || {}, (req as any).user) }); }),
  reconcileMovement: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.reconcileMovement(scope(req), req.params.id, req.body || {}, (req as any).user) }); }),
  transferDrawer: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.transferDrawer(scope(req), req.params.id, req.body || {}, (req as any).user) }); }),
  settlements: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.settlements(scope(req), req.query) }); }),
  reviewSettlement: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.reviewSettlement(scope(req), req.body || {}, (req as any).user) }); }),
  current: asyncHandler(async (req, res) => { const shift = await CashierShiftService.current(scope(req), (req as any).user, String(req.query.terminalId || "default")); res.json({ success: true, data: shift ? serializeCashierShift(shift, await hasEffectiveRetailCapability((req as any).user || {}, "manager")) : null }); }),
  list: asyncHandler(async (req, res) => { const data = await CashierShiftService.list(scope(req), req.query); const manager = await hasEffectiveRetailCapability((req as any).user || {}, "manager"); res.json({ success: true, data: { ...data, items: data.items.map((shift) => serializeCashierShift(shift, manager)) } }); }),
  detail: asyncHandler(async (req, res) => { const data = await CashierShiftService.detail(scope(req), req.params.id, req.query); res.json({ success: true, data }); }),
  open: asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: serializeCashierShift(await CashierShiftService.open(scope(req), { ...(req.body || {}), terminalId: req.query.terminalId || req.body?.terminalId }, (req as any).user), true) }); }),
  close: asyncHandler(async (req, res) => { const actor = (req as any).user; res.json({ success: true, data: serializeCashierShift(await CashierShiftService.close(scope(req), req.params.id, { ...(req.body || {}), terminalId: req.query.terminalId }, actor), await hasEffectiveRetailCapability(actor, "manager")) }); }),
  reconcile: asyncHandler(async (req, res) => { res.json({ success: true, data: await CashierShiftService.reconcile(scope(req), req.params.id, req.body || {}, (req as any).user) }); }),
};
