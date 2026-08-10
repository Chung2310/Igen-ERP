import type { NextFunction, Request, Response } from "express";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { hasEffectiveRetailCapability } from "../permissions";
import { RetailReportService } from "../services/retail-report.service";

type RetailReportControllerDependencies = {
  hasCapability: typeof hasEffectiveRetailCapability;
  summary: typeof RetailReportService.summary;
};

function scope(req: Request) {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export function createRetailReportController(dependencies: RetailReportControllerDependencies) {
  return {
    summary: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = (req as any).user || {};
        const includeProfit = await dependencies.hasCapability(actor, "manager");
        const data = await dependencies.summary(scope(req), req.query, includeProfit);
        return res.json({ success: true, data });
      } catch (error) {
        return next(error);
      }
    },
  };
}

export const retailReportController = createRetailReportController({
  hasCapability: hasEffectiveRetailCapability,
  summary: RetailReportService.summary,
});
