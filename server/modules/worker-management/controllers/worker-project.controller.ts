import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../middleware/auth";
import { workerScopeFromRequest } from "../contracts";
import { WorkerProjectService } from "../services/worker-project.service";

function getScope(req: AuthenticatedRequest) {
  return workerScopeFromRequest(req.user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  });
}

export class WorkerProjectController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const project = await WorkerProjectService.create(scope, req.body);
      res.status(201).json({ success: true, data: project });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const { companyCode: _companyCode, branchId: _branchId, ...filters } = req.query;
      const list = await WorkerProjectService.list(scope, filters);
      res.json({ success: true, data: list });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getDetail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const project = await WorkerProjectService.getDetail(scope, req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, error: "Không tìm thấy dự án." });
      }
      res.json({ success: true, data: project });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const project = await WorkerProjectService.update(scope, req.params.id, req.body);
      res.json({ success: true, data: project });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      await WorkerProjectService.delete(scope, req.params.id);
      res.json({ success: true, message: "Xóa dự án thành công." });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async addWorker(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const project = await WorkerProjectService.addWorker(scope, req.params.id, req.body.workerId);
      res.json({ success: true, data: project });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async removeWorker(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = getScope(req);
      const project = await WorkerProjectService.removeWorker(scope, req.params.id, req.params.workerId);
      res.json({ success: true, data: project });
    } catch (error: unknown) {
      next(error);
    }
  }
}
