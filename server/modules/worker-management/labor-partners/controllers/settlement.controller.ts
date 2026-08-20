import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { LaborPartnerSettlementCalculationService } from "../services/settlement-calculation.service";
import { LaborPartnerSettlementOperationService } from "../services/settlement-operation.service";
import { LaborPartnerSettlementQueryService } from "../services/settlement-query.service";

function operationError(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
  return next(error);
}

export const settlementController = {
  createAdjustment: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.status(201).json({ success: true, data: await LaborPartnerSettlementOperationService.createAdjustment(scope, req.params.settlementId, req.body || {}, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
  recalculate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await LaborPartnerSettlementCalculationService.recalculate(scope, req.params.settlementId, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
  void: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await LaborPartnerSettlementOperationService.void(scope, req.params.settlementId, req.body?.expectedVersion, req.body?.reason, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });
      res.json({ success: true, data: await LaborPartnerSettlementQueryService.list(scope, req.query as Record<string, unknown>) });
    } catch (error) { operationError(res, error, next); }
  },
  detail: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });
      const data = await LaborPartnerSettlementQueryService.detail(scope, req.params.settlementId);
      if (!data) return res.status(404).json({ success: false, error: { code: "SETTLEMENT_NOT_FOUND", message: "Không tìm thấy kỳ đối soát." } });
      res.json({ success: true, data });
    } catch (error) { operationError(res, error, next); }
  },
  calculate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId });
      const result = await LaborPartnerSettlementCalculationService.calculate(scope, req.body || {}, (req.user || {}) as any);
      res.status(result.reused ? 200 : 201).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
      next(error);
    }
  },
  approve: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.json({ success: true, data: await LaborPartnerSettlementOperationService.approve(scope, req.params.settlementId, req.body?.expectedVersion, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
  payout: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.status(201).json({ success: true, data: await LaborPartnerSettlementOperationService.payout(scope, req.params.settlementId, req.body || {}, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
  reversePayout: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const scope = workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); res.status(201).json({ success: true, data: await LaborPartnerSettlementOperationService.reversePayout(scope, req.params.payoutId, (req.user || {}) as any) }); } catch (error) { operationError(res, error, next); } },
};
