import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { LaborPartnerKpiService } from "../services/partner-kpi.service";

function scope(req: AuthenticatedRequest) { return workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); }
function sendError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  return next(error);
}

export const partnerKpiController = {
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await LaborPartnerKpiService.list(scope(req), String(req.query.periodAnchor)); res.json({ success: true, data }); } catch (error) { sendError(res, error, next); } },
  upsert: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await LaborPartnerKpiService.upsert(scope(req), req.params.partnerId, req.body, req.user as any); res.json({ success: true, data }); } catch (error) { sendError(res, error, next); } },
};
