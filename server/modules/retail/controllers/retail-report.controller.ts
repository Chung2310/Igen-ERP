import type { NextFunction, Request, Response } from "express";
import { BranchModel } from "../../../model/branch.model";
import { requireRetailBranch, retailScopeFromRequest, RetailScopeError, type RetailScope, type RetailBranchScope } from "../contracts";
import { hasEffectiveRetailCapability } from "../permissions";
import { buildRetailReportWorkbook } from "../services/retail-report-export.service";
import { RetailReportService } from "../services/retail-report.service";
import { RetailDebtReminderService } from "../services/retail-debt-reminder.service";

type BranchLookup = {
  findOne(filter: { _id: string; companyCode: string }): {
    select(selection: string): {
      lean(): Promise<{ code?: unknown } | null>;
    };
  };
};

type RetailReportControllerDependencies = {
  hasCapability: typeof hasEffectiveRetailCapability;
  summary: typeof RetailReportService.summary;
  findBranchCode?: typeof loadRetailReportBranchCode;
  buildWorkbook?: typeof buildRetailReportWorkbook;
};

export async function retailReportScope(req: Request, findBranchCode = loadRetailReportBranchCode): Promise<RetailScope> {
  const actor = (req as any).user || {};
  const requestedBranch = String(req.query.branchId || "").trim();
  if (actor.role !== "admin" && actor.role !== "superadmin") return scope(req);
  const companyScope = retailScopeFromRequest(actor, { companyCode: req.query.companyCode });
  if (requestedBranch === "all") return { companyCode: companyScope.companyCode };
  const reportScope = requireRetailBranch({ ...companyScope, ...(requestedBranch ? { branchId: requestedBranch } : {}) });
  if (requestedBranch && requestedBranch !== actor.branchId) await findBranchCode(reportScope);
  return reportScope;
}

function scope(req: Request) {
  return requireRetailBranch(retailScopeFromRequest((req as any).user || {}, {
    companyCode: req.query.companyCode,
    branchId: req.query.branchId,
  }));
}

export async function loadRetailReportBranchCode(
  reportScope: RetailBranchScope,
  branchModel: BranchLookup = BranchModel as unknown as BranchLookup,
): Promise<string> {
  if (!/^[a-f0-9]{24}$/i.test(reportScope.branchId) && branchModel === (BranchModel as unknown as BranchLookup)) throw new RetailScopeError("Chi nhánh không hợp lệ.", 400);
  const branch = await branchModel.findOne({
    _id: reportScope.branchId,
    companyCode: reportScope.companyCode,
  }).select("code").lean();
  const code = String(branch?.code || "").trim();
  if (!code) {
    throw Object.assign(new Error("Không tìm thấy chi nhánh bán hàng."), { status: 404 });
  }
  return code;
}

export function createRetailReportController(dependencies: RetailReportControllerDependencies) {
  const findBranchCode = dependencies.findBranchCode || loadRetailReportBranchCode;
  const buildWorkbook = dependencies.buildWorkbook || buildRetailReportWorkbook;
  return {
    summary: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = (req as any).user || {};
        const includeProfit = await dependencies.hasCapability(actor, "manager");
        const data = await dependencies.summary(await retailReportScope(req, findBranchCode), req.query, includeProfit);
        return res.json({ success: true, data });
      } catch (error) {
        return next(error);
      }
    },
    export: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = (req as any).user || {};
        const includeProfit = await dependencies.hasCapability(actor, "manager");
        const reportScope = await retailReportScope(req, findBranchCode);
        const branchCode = reportScope.branchId ? await findBranchCode(requireRetailBranch(reportScope)) : "ALL";
        const model = await dependencies.summary(reportScope, req.query, includeProfit);
        const { buffer, filename } = buildWorkbook(model, { includeProfit, branchCode });
        const attachmentFilename = filename.replace(/[^A-Za-z0-9._-]/g, "-");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${attachmentFilename}"`);
        return res.send(buffer);
      } catch (error) {
        return next(error);
      }
    },
  };
}

export const retailReportController = createRetailReportController({
  hasCapability: hasEffectiveRetailCapability,
  summary: RetailReportService.summary,
  findBranchCode: loadRetailReportBranchCode,
  buildWorkbook: buildRetailReportWorkbook,
});

export async function remindOverdueRetailDebt(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: await RetailDebtReminderService.run(scope(req)) });
  } catch (error) {
    return next(error);
  }
}
