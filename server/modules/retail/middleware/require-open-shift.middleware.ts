import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { CashierShiftService } from "../services/cashier-shift.service";

export async function requireOpenShift(req: Request, _res: Response, next: NextFunction) {
  const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }));
  try {
    (req as any).currentShift = await CashierShiftService.operational(scope, (req as any).user || {});
    return next();
  } catch (error) {
    return next(error);
  }
}
