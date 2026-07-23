import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { dashboardService, DashboardRange } from "../service/dashboard.service";
import { getEnabledModulesForCompany } from "../middleware/require-module";

/**
 * Quy đổi bộ lọc thời gian của trang tổng quan thành khoảng ngày cụ thể.
 * Ngữ nghĩa trùng với isDateInFilter phía frontend (DashboardTab):
 * - day: từ đầu ngày hôm nay đến hiện tại
 * - week: 7 ngày gần nhất
 * - year: từ 1/1 năm nay đến hiện tại
 * - custom: startDate 00:00:00 -> endDate 23:59:59
 */
function resolveRange(
  filter: string,
  startDate?: string,
  endDate?: string
): DashboardRange | null {
  const now = new Date();

  switch (filter) {
    case "week": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now, filter };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now, filter };
    }
    case "custom": {
      if (!startDate || !endDate) return null;
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
      return { start, end, filter };
    }
    case "day":
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now, filter: "day" };
    }
  }
}

export const dashboardController = {
  /**
   * GET /api/v1/dashboard/summary
   */
  async getSummary(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const filter = String(req.query.filter || "day");
      const range = resolveRange(
        filter,
        req.query.startDate as string | undefined,
        req.query.endDate as string | undefined
      );

      if (!range) {
        return res.status(400).json({
          status: "error",
          message: "Bộ lọc tùy chọn cần startDate và endDate hợp lệ (YYYY-MM-DD).",
        });
      }

      const enabledModules = req.user.companyCode
        ? await getEnabledModulesForCompany(req.user.companyCode)
        : undefined;

      const data = await dashboardService.getSummary(
        {
          id: req.user.id,
          role: req.user.role,
          companyCode: req.user.companyCode,
          enabledModules,
        },
        range
      );

      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[dashboardController.getSummary] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi tổng hợp dữ liệu trang tổng quan.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/dashboard/action-items
   */
  async getActionItems(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const enabledModules = req.user.companyCode
        ? await getEnabledModulesForCompany(req.user.companyCode)
        : undefined;

      const data = await dashboardService.getActionItems({
        id: req.user.id,
        role: req.user.role,
        companyCode: req.user.companyCode,
        enabledModules,
      });

      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[dashboardController.getActionItems] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi tổng hợp việc cần xử lý hôm nay.",
        details: error.message,
      });
    }
  },
};
