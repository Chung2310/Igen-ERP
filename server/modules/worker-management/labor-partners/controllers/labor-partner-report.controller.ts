import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { workerScopeFromRequest } from "../../contracts";
import { LaborPartnerError } from "../contracts";
import { laborPartnerWorkbookBuffer, buildLaborPartnerReportWorkbook } from "../services/labor-partner-export.service";
import { LaborPartnerReportService } from "../services/labor-partner-report.service";

function scope(req: AuthenticatedRequest) { return workerScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode, branchId: req.query.branchId }); }
function errorResponse(res: Response, error: unknown, next: NextFunction) {
  if (error instanceof LaborPartnerError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  return next(error);
}

export const laborPartnerReportController = {
  dashboard: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const data = await LaborPartnerReportService.get(scope(req), req.query as Record<string, unknown>); res.json({ success: true, data: data.summary }); } catch (error) { errorResponse(res, error, next); } },
  commission: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await LaborPartnerReportService.get(scope(req), req.query as Record<string, unknown>) }); } catch (error) { errorResponse(res, error, next); } },
  export: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const report = await LaborPartnerReportService.get(scope(req), req.query as Record<string, unknown>);
      const buffer = laborPartnerWorkbookBuffer(buildLaborPartnerReportWorkbook(report));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=labor-partner-commission-${String(req.query.periodFrom || "all")}-${String(req.query.periodTo || "all")}.xlsx`);
      res.send(buffer);
    } catch (error) { errorResponse(res, error, next); }
  },
};
