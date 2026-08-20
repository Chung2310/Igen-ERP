import type { NextFunction, Request, Response } from "express";
import { financeScopeFromRequest, requireFinanceBranch } from "../contracts";
import { AssetInventoryService } from "../services/asset-inventory.service";
import { validateInventoryCount, validateInventoryOpening } from "../validations/asset-inventory.validation";

const companyScope = (req: Request) => financeScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId });
const branchScope = (req: Request) => requireFinanceBranch(companyScope(req));

export function createAssetInventoryController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run((req) => dependencies.list(companyScope(req), req.query)),
    detail: run((req) => dependencies.detail(companyScope(req), req.params.id)),
    variance: run((req) => dependencies.variance(companyScope(req), req.params.id)),
    open: run((req) => dependencies.open(branchScope(req), validateInventoryOpening(req.body), (req as any).user || {})),
    count: run((req) => dependencies.count(companyScope(req), req.params.id, validateInventoryCount(req.body), (req as any).user || {})),
    finalize: run((req) => dependencies.finalize(companyScope(req), req.params.id, (req as any).user || {})),
  };
}

export const assetInventoryController = createAssetInventoryController(AssetInventoryService);
