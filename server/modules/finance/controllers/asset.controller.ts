import type { NextFunction, Request, Response } from "express";
import { financeScopeFromRequest, requireFinanceBranch } from "../contracts";
import { AssetService } from "../services/asset.service";
import { validateAssetCreation, validateAssetDisposal, validateAssetTransfer, validateAssetUpdate, validatePeriod } from "../validations/asset.validation";

const companyScope = (req: Request) => financeScopeFromRequest((req as any).user || {}, { companyCode: req.query?.companyCode, branchId: req.query?.branchId });
const branchScope = (req: Request) => requireFinanceBranch(companyScope(req));

export function createAssetController(dependencies: any) {
  const run = (handler: (req: Request) => Promise<any>) => async (req: Request, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await handler(req) }); } catch (error) { return next(error); }
  };
  return {
    list: run((req) => dependencies.list(companyScope(req), req.query)),
    detail: run((req) => dependencies.detail(companyScope(req), req.params.id)),
    schedule: run((req) => dependencies.schedule(companyScope(req), req.params.id)),
    create: run((req) => dependencies.create(branchScope(req), validateAssetCreation(req.body), (req as any).user || {})),
    update: run((req) => dependencies.update(companyScope(req), req.params.id, validateAssetUpdate(req.body), (req as any).user || {})),
    transfer: run((req) => dependencies.transfer(companyScope(req), req.params.id, validateAssetTransfer(req.body), (req as any).user || {})),
    dispose: run((req) => dependencies.dispose(companyScope(req), req.params.id, validateAssetDisposal(req.body), (req as any).user || {})),
    listDepreciations: run((req) => dependencies.listDepreciations(companyScope(req), validatePeriod(req.query?.period))),
    runDepreciation: run((req) => dependencies.runDepreciation(companyScope(req), validatePeriod(req.body?.period))),
    postDepreciation: run((req) => dependencies.postDepreciation(companyScope(req), validatePeriod(req.body?.period), (req as any).user || {})),
  };
}

export const assetController = createAssetController(AssetService);
