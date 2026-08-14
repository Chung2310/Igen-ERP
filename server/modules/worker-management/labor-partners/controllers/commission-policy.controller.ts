import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { CommissionPolicyService } from "../services/commission-policy.service";

function scope(req: AuthenticatedRequest) { return workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); }
function actor(req: AuthenticatedRequest) { return (req.user || {}) as unknown as Record<string, unknown>; }
function handle(res: Response, error: unknown, next: NextFunction) { if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }); return next(error); }

export const commissionPolicyController = {
  clone: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await CommissionPolicyService.clone(scope(req), req.params.policyId, req.body || {}, actor(req)) }); } catch (error) { handle(res, error, next); } },
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await CommissionPolicyService.list(scope(req)) }); } catch (error) { handle(res, error, next); } },
  detail: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await CommissionPolicyService.get(scope(req), req.params.policyId); if (!data) return res.status(404).json({ success: false, error: { code: "POLICY_NOT_FOUND", message: "Không tìm thấy chính sách." } }); res.json({ success: true, data }); } catch (error) { handle(res, error, next); } },
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await CommissionPolicyService.create(scope(req), req.body || {}, actor(req)) }); } catch (error) { handle(res, error, next); } },
  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await CommissionPolicyService.update(scope(req), req.params.policyId, req.body || {}) }); } catch (error) { handle(res, error, next); } },
  activate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await CommissionPolicyService.activate(scope(req), req.params.policyId, actor(req)) }); } catch (error) { handle(res, error, next); } },
  retire: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await CommissionPolicyService.retire(scope(req), req.params.policyId) }); } catch (error) { handle(res, error, next); } },
  remove: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await CommissionPolicyService.remove(scope(req), req.params.policyId) }); } catch (error) { handle(res, error, next); } },
};
