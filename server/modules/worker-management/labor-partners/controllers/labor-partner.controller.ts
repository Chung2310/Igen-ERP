import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { LaborPartnerService } from "../services/labor-partner.service";

function scope(req: AuthenticatedRequest) { return workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); }
function sendError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  return next(error);
}

export const laborPartnerController = {
  overview: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await LaborPartnerService.overview(scope(req), req.params.partnerId); if (!data) return res.status(404).json({ success: false, error: { code: "LABOR_PARTNER_NOT_FOUND", message: "Không tìm thấy đối tác lao động." } }); res.json({ success: true, data }); } catch (error) { sendError(res, error, next); } },
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await LaborPartnerService.list(scope(req), req.query as any) }); } catch (error) { sendError(res, error, next); } },
  detail: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await LaborPartnerService.get(scope(req), req.params.partnerId); if (!data) return res.status(404).json({ success: false, error: { code: "LABOR_PARTNER_NOT_FOUND", message: "Không tìm thấy đối tác lao động." } }); res.json({ success: true, data }); } catch (error) { sendError(res, error, next); } },
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await LaborPartnerService.create(scope(req), req.body || {}) }); } catch (error) { sendError(res, error, next); } },
  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await LaborPartnerService.update(scope(req), req.params.partnerId, req.body || {}) }); } catch (error) { sendError(res, error, next); } },
  remove: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await LaborPartnerService.remove(scope(req), req.params.partnerId) }); } catch (error) { sendError(res, error, next); } },
};
