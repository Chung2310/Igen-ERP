import type { NextFunction, Request, Response } from "express";
import { resolveFinanceScopeFromRequest, requireFinanceBranch } from "../contracts";
import { AssetInventoryService } from "../services/asset-inventory.service";
import { validateInventoryCount, validateInventoryOpening } from "../validations/asset-inventory.validation";

const companyScope = (req: Request) => resolveFinanceScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId });
const branchScope = async (req: Request) => requireFinanceBranch(await companyScope(req));

export function createAssetInventoryController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run(async (req) => dependencies.list(await companyScope(req), req.query)),
    detail: run(async (req) => dependencies.detail(await companyScope(req), req.params.id)),
    variance: run(async (req) => dependencies.variance(await companyScope(req), req.params.id)),
    open: run(async (req) => dependencies.open(await branchScope(req), validateInventoryOpening(req.body), (req as any).user || {})),
    count: run(async (req) => dependencies.count(await companyScope(req), req.params.id, validateInventoryCount(req.body), (req as any).user || {})),
    finalize: run(async (req) => dependencies.finalize(await companyScope(req), req.params.id, (req as any).user || {})),
  };
}

export const assetInventoryController = createAssetInventoryController(AssetInventoryService);
