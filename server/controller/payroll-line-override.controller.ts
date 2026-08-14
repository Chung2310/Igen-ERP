import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  bulkSavePayrollLineOverrides,
  listPayrollLineOverrides,
} from "../service/payroll-line-override-operations.service";

const scope = (req: AuthenticatedRequest) => ({
  companyCode: req.user!.companyCode!,
  branchId: req.user!.branchId!,
});

const fail = (res: Response, error: any) => res.status(error?.status ?? 500).json({
  status: "error",
  code: error?.code ?? "PAYROLL_LINE_OVERRIDE_ERROR",
  message: error instanceof Error ? error.message : "Unable to process payroll line overrides",
});

export const payrollLineOverrideController = {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({
        status: "success",
        data: await listPayrollLineOverrides(scope(req), req.params.periodKey),
      });
    } catch (error) {
      return fail(res, error);
    }
  },

  async bulk(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({
        status: "success",
        data: await bulkSavePayrollLineOverrides(
          scope(req),
          req.params.periodKey,
          req.user!.id,
          req.body?.rows,
        ),
      });
    } catch (error) {
      return fail(res, error);
    }
  },
};
