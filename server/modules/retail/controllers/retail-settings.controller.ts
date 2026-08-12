import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { getResolvedRetailSettings, updateRetailSettings } from "../services/retail-settings.service";

function scope(req: Request) {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export const retailSettingsController = {
  get: async (req: Request, res: Response) => res.json({ success: true, data: await getResolvedRetailSettings(scope(req)) }),
  update: async (req: Request, res: Response) => res.json({ success: true, data: await updateRetailSettings(scope(req), req.body || {}) }),
};
