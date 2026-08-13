import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../middleware/auth";
import { workerScopeFromRequest } from "../contracts";
import { WorkerLaborContractService } from "../services/worker-labor-contract.service";

function getScope(req: AuthenticatedRequest) {
  return workerScopeFromRequest(req.user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  });
}

function actorOf(req: AuthenticatedRequest) {
  const user = (req.user || {}) as Record<string, unknown>;
  return String(user.email || user.username || user.userId || "");
}

export class WorkerLaborContractController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const contract = await WorkerLaborContractService.create(getScope(req), req.body);
      res.status(201).json({ success: true, data: contract });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const { companyCode: _companyCode, branchId: _branchId, ...filters } = req.query;
      const list = await WorkerLaborContractService.list(scope, filters);
      res.json({ success: true, data: list });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const contract = await WorkerLaborContractService.getDetail(getScope(req), req.params.id);
      if (!contract) {
        return res.status(404).json({ success: false, error: "Không tìm thấy hợp đồng." });
      }
      res.json({ success: true, data: contract });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const history = await WorkerLaborContractService.history(getScope(req), req.params.id);
      res.json({ success: true, data: history });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const contract = await WorkerLaborContractService.update(
        getScope(req),
        req.params.id,
        req.body,
      );
      res.json({ success: true, data: contract });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async renew(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await WorkerLaborContractService.renew(
        getScope(req),
        req.params.id,
        req.body,
        actorOf(req),
      );
      res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await WorkerLaborContractService.delete(getScope(req), req.params.id);
      res.json({ success: true, message: "Xóa hợp đồng thành công." });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getExpiringSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await WorkerLaborContractService.expiringSummary(getScope(req));
      res.json({ success: true, data: summary });
    } catch (error: unknown) {
      next(error);
    }
  }
}
