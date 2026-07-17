import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { superAdminDashboardService } from "../service/super-admin-dashboard.service";
import { superAdminAuditService } from "../service/super-admin-audit.service";

export const superAdminController = {
  /**
   * GET /api/v1/super-admin/dashboard/summary
   */
  async getDashboardSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const summary = await superAdminDashboardService.getSummary({ startDate, endDate });

      return res.status(200).json({
        status: "success",
        data: summary,
      });
    } catch (error: any) {
      console.error("[superAdminController.getDashboardSummary] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi tổng hợp dữ liệu dashboard Super Admin.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/super-admin/audit/events
   */
  async getAuditEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "20"), 10);

      const filters = {
        actorSuperAdminId: req.query.actorSuperAdminId as string | undefined,
        effectiveUserId: req.query.effectiveUserId as string | undefined,
        companyCode: req.query.companyCode as string | undefined,
        environment: req.query.environment as string | undefined,
        riskClass: req.query.riskClass as string | undefined,
        result: req.query.result as string | undefined,
        actionType: req.query.actionType as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const result = await superAdminAuditService.queryEvents(filters, { page, limit });

      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error: any) {
      console.error("[superAdminController.getAuditEvents] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi tải danh sách nhật ký kiểm toán.",
        details: error.message,
      });
    }
  },
};
