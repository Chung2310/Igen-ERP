import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  listMyPublishedPayslipReviews,
  listRunPublishedPayslipReviews,
  payslipReviewError,
  requestPublishedPayslipReview,
  resolvePublishedPayslipReview,
} from "../service/payroll-payslip-review.service";

const scope = (req: AuthenticatedRequest) => {
  const companyCode = req.user?.companyCode;
  const branchId = req.user?.branchId;
  if (!companyCode || !branchId) throw payslipReviewError("Cần tài khoản thuộc doanh nghiệp và chi nhánh.", 400);
  return { companyCode, branchId };
};

const handle = (operation: (req: AuthenticatedRequest) => Promise<unknown>, successStatus = 200) =>
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.status(successStatus).json({ status: "success", data: await operation(req) });
    } catch (error: any) {
      return res.status(error.status ?? 500).json({
        status: "error",
        code: error.code ?? "PAYSLIP_REVIEW_ERROR",
        message: error.message ?? "Không thể xử lý yêu cầu kiểm tra lại lương.",
      });
    }
  };

export const payrollPayslipReviewController = {
  mine: handle((req) => listMyPublishedPayslipReviews(scope(req), req.user!.id)),
  create: handle((req) => requestPublishedPayslipReview(scope(req), req.user!.id, req.params.id, req.body?.message), 201),
  listRun: handle((req) => listRunPublishedPayslipReviews(scope(req), req.params.id)),
  resolve: handle((req) => resolvePublishedPayslipReview(scope(req), req.params.id, req.params.requestId, req.user!.id, req.body?.response)),
};
