import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { WorkerReferralService } from "../services/worker-referral.service";

function scope(req: AuthenticatedRequest) { return workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); }
function actor(req: AuthenticatedRequest) { return (req.user || {}) as unknown as Record<string, unknown>; }
function handle(res: Response, error: unknown, next: NextFunction) { if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } }); return next(error); }

export const workerReferralController = {
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await WorkerReferralService.listForPartner(scope(req), req.params.partnerId) }); } catch (error) { handle(res, error, next); } },
  listForWorker: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await WorkerReferralService.getForWorker(scope(req), req.params.workerId) }); } catch (error) { handle(res, error, next); } },
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await WorkerReferralService.create(scope(req), req.params.partnerId, req.body || {}, actor(req)) }); } catch (error) { handle(res, error, next); } },
  confirm: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await WorkerReferralService.confirm(scope(req), req.params.partnerId, req.params.referralId, actor(req)) }); } catch (error) { handle(res, error, next); } },
  end: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await WorkerReferralService.end(scope(req), req.params.partnerId, req.params.referralId, req.body?.effectiveTo) }); } catch (error) { handle(res, error, next); } },
};
