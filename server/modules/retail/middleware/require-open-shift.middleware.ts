import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { CashierShiftService } from "../services/cashier-shift.service";

export async function requireOpenShift(req: Request, _res: Response, next: NextFunction) {
  const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
  const shift = await CashierShiftService.current(scope, (req as any).user || {});
  if (!shift) return next(Object.assign(new Error("Bạn chưa mở ca bán hàng."), { status: 409, code: "SHIFT_NOT_OPEN" }));
  (req as any).currentShift = shift; return next();
}
