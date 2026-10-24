import type { Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { getResolvedRetailSettings, updateRetailSettings } from "../services/retail-settings.service";
import { CompanyModel } from "../../../model/company.model";

function scope(req: Request) {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export const retailSettingsController = {
  get: async (req: Request, res: Response) => res.json({ success: true, data: await getResolvedRetailSettings(scope(req)) }),
  printConfig: async (req: Request, res: Response) => {
    const retailScope = scope(req);
    const [settings, company] = await Promise.all([
      getResolvedRetailSettings(retailScope),
      CompanyModel.findOne({ code: retailScope.companyCode }).select("name").lean(),
    ]);
    return res.json({ success: true, data: { invoicePaperSize: settings.invoicePaperSize, invoiceTemplate: settings.invoiceTemplate, defaultTaxRate: settings.defaultTaxRate, storeName: String(company?.name || "") } });
  },
  update: async (req: Request, res: Response) => res.json({ success: true, data: await updateRetailSettings(scope(req), req.body || {}) }),
};
