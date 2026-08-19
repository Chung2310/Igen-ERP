import type { NextFunction, Request, Response } from "express";
import { CustomerError } from "../customer-errors";
import { CustomerSettingsService } from "../services/customer-settings.service";

function getCompanyCode(req: Request): string {
  const user = (req as any).user || {};
  const rawCompanyCode = user.role === "superadmin" ? req.query.companyCode : user.companyCode;
  const companyCode = String(rawCompanyCode || "").trim().toUpperCase();
  if (!companyCode) {
    throw new CustomerError("CUSTOMER_COMPANY_REQUIRED", "Phạm vi công ty là bắt buộc.", 400);
  }
  return companyCode;
}

const handle = (action: (req: Request, res: Response) => Promise<Response>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    return await action(req, res);
  } catch (error) {
    if (error instanceof CustomerError) {
      return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return next(error);
  }
};

export const customerSettingsController = {
  get: handle(async (req, res) => {
    const companyCode = getCompanyCode(req);
    const data = await CustomerSettingsService.getSettings(companyCode);
    return res.json({ success: true, data });
  }),

  update: handle(async (req, res) => {
    const companyCode = getCompanyCode(req);
    const tiers = req.body?.customerTiers;
    const data = await CustomerSettingsService.updateSettings(companyCode, tiers);
    return res.json({ success: true, data });
  }),
};
