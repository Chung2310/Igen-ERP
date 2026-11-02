import type { NextFunction, Request, Response } from "express";
import { resolveFinanceScopeFromRequest, requireFinanceBranch } from "../contracts";
import { AssetService } from "../services/asset.service";
import { validateAssetCreation, validateAssetDisposal, validateAssetTransfer, validateAssetUpdate, validatePeriod } from "../validations/asset.validation";

const companyScope = (req: Request) => resolveFinanceScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId });
const branchScope = async (req: Request) => requireFinanceBranch(await companyScope(req));

export function createAssetController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run(async (req) => dependencies.list(await companyScope(req), req.query)),
    detail: run(async (req) => dependencies.detail(await companyScope(req), req.params.id)),
    schedule: run(async (req) => dependencies.schedule(await companyScope(req), req.params.id)),
    create: run(async (req) => dependencies.create(await branchScope(req), validateAssetCreation(req.body), (req as any).user || {})),
    update: run(async (req) => dependencies.update(await companyScope(req), req.params.id, validateAssetUpdate(req.body), (req as any).user || {})),
    transfer: run(async (req) => dependencies.transfer(await companyScope(req), req.params.id, validateAssetTransfer(req.body), (req as any).user || {})),
    dispose: run(async (req) => dependencies.dispose(await companyScope(req), req.params.id, validateAssetDisposal(req.body), (req as any).user || {})),
    listDepreciations: run(async (req) => dependencies.listDepreciations(await companyScope(req), validatePeriod(req.query?.period))),
    runDepreciation: run(async (req) => dependencies.runDepreciation(await companyScope(req), validatePeriod(req.body?.period))),
    postDepreciation: run(async (req) => dependencies.postDepreciation(await companyScope(req), validatePeriod(req.body?.period), (req as any).user || {})),
  };
}

export const assetController = createAssetController(AssetService);
