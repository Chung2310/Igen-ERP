import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { analyticsService, RevenueGranularity } from "../service/analytics.service";
import { OperatingExpenseModel } from "../model/operating-expense.model";
import { invalidateAnalyticsCache, withAnalyticsCache } from "../service/analytics-cache.service";
import {
  analyticsWorkbookBuffer,
  buildAnalyticsCsv,
  buildAnalyticsWorkbook,
  type AnalyticsExportFormat,
  type AnalyticsExportReport,
} from "../service/analytics-export.service";

/**
 * Khoảng thời gian báo cáo. Dùng UTC để khớp với cách `paidOn` được lưu
 * (mốc 00:00 UTC của ngày nghiệp vụ) — nếu quy đổi theo giờ máy chủ thì giao
 * dịch đầu/cuối kỳ sẽ rơi lệch một ngày.
 */
function resolveRange(from: string, to: string, granularity: RevenueGranularity) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return null;
  }

  return { from: start, to: end, granularity };
}

function resolveScope(req: AuthenticatedRequest) {
  return {
    companyCode: req.user?.companyCode,
    branchId: req.query.branchId ? String(req.query.branchId) : undefined,
    courseId: req.query.courseId ? String(req.query.courseId) : undefined,
  };
}

export const analyticsController = {
  async listOperatingExpenses(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
    const range = resolveRange(String(req.query.from), String(req.query.to), "day");
    if (!range) return res.status(400).json({ status: "error", message: "Khoảng thời gian không hợp lệ." });
    const query: Record<string, unknown> = { companyCode: req.user.companyCode, incurredOn: { $gte: range.from, $lte: range.to } };
    if (req.query.branchId) query.branchId = String(req.query.branchId);
    const data = await OperatingExpenseModel.find(query).sort({ incurredOn: -1, createdAt: -1 }).lean();
    return res.status(200).json({ status: "success", data });
  },

  async createOperatingExpense(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
    const data = await OperatingExpenseModel.create({
      companyCode: req.user.companyCode,
      branchId: req.body.branchId || undefined,
      category: req.body.category,
      description: req.body.description,
      amount: req.body.amount,
      incurredOn: new Date(`${req.body.incurredOn}T12:00:00.000Z`),
      status: "confirmed",
      createdBy: req.user.id,
    });
    await invalidateAnalyticsCache(req.user.companyCode);
    return res.status(201).json({ status: "success", data });
  },

  async voidOperatingExpense(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
    const data = await OperatingExpenseModel.findOneAndUpdate(
      { _id: req.params.id, companyCode: req.user.companyCode },
      { $set: { status: "void" } },
      { returnDocument: 'after' }
    );
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy khoản chi." });
    await invalidateAnalyticsCache(req.user.companyCode);
    return res.status(200).json({ status: "success", data });
  },
  /**
   * GET /api/v1/analytics/meta
   *
   * Cho UI biết báo cáo nào đang có dữ liệu đủ điều kiện để hiển thị. Mục đích là
   * để trang phân tích ẩn/khóa đúng khối thay vì vẽ ra số 0 — số 0 trong báo cáo
   * tài chính bị đọc là "không có doanh thu", khác hẳn "chưa có dữ liệu".
   */
  async getMeta(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const data = await analyticsService.getMeta({
        companyCode: req.user.companyCode,
      });

      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[analyticsController.getMeta] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi kiểm tra tình trạng dữ liệu báo cáo.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/analytics/revenue
   */
  async getRevenue(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const range = resolveRange(
        String(req.query.from),
        String(req.query.to),
        (req.query.granularity as RevenueGranularity) || "day"
      );

      if (!range) {
        return res.status(400).json({
          status: "error",
          message: "Khoảng thời gian không hợp lệ: cần from <= to, định dạng YYYY-MM-DD.",
        });
      }

      const data = await withAnalyticsCache(req.user.companyCode, req.originalUrl, () =>
        analyticsService.getCombinedRevenue(resolveScope(req), range)
      );

      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[analyticsController.getRevenue] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi tổng hợp doanh thu.",
        details: error.message,
      });
    }
  },

  async getReceivables(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      const asOf = new Date(`${String(req.query.asOf)}T23:59:59.999Z`);
      if (isNaN(asOf.getTime())) return res.status(400).json({ status: "error", message: "asOf phải đúng định dạng YYYY-MM-DD." });
      const data = await withAnalyticsCache(req.user.companyCode, req.originalUrl, () => analyticsService.getReceivables(resolveScope(req), asOf));
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[analyticsController.getReceivables] Error:", error);
      return res.status(500).json({ status: "error", message: "Lỗi hệ thống khi tổng hợp công nợ.", details: error.message });
    }
  },

  async getExpenses(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      const range = resolveRange(String(req.query.from), String(req.query.to), "day");
      if (!range) return res.status(400).json({ status: "error", message: "Khoảng thời gian không hợp lệ." });
      const data = await withAnalyticsCache(req.user.companyCode, req.originalUrl, () => analyticsService.getExpenses(resolveScope(req), range));
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[analyticsController.getExpenses] Error:", error);
      return res.status(500).json({ status: "error", message: "Lỗi hệ thống khi tổng hợp chi phí.", details: error.message });
    }
  },

  async getProfitAndLoss(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      const range = resolveRange(String(req.query.from), String(req.query.to), (req.query.granularity as RevenueGranularity) || "day");
      if (!range) return res.status(400).json({ status: "error", message: "Khoảng thời gian không hợp lệ." });
      const data = await withAnalyticsCache(req.user.companyCode, req.originalUrl, () => analyticsService.getProfitAndLoss(resolveScope(req), range));
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[analyticsController.getProfitAndLoss] Error:", error);
      return res.status(500).json({ status: "error", message: "Lỗi hệ thống khi tổng hợp P&L.", details: error.message });
    }
  },

  async exportReport(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      const report = req.query.report as AnalyticsExportReport;
      const format = req.query.format as AnalyticsExportFormat;
      const range = resolveRange(String(req.query.from), String(req.query.to), (req.query.granularity as RevenueGranularity) || "day");
      if (!range) return res.status(400).json({ status: "error", message: "Khoảng thời gian không hợp lệ." });
      const scope = resolveScope(req);
      const data: Record<string, any> = {};

      if (report === "overview") {
        [data.revenue, data.receivables, data.expenses] = await Promise.all([
          analyticsService.getCombinedRevenue(scope, range),
          analyticsService.getReceivables(scope, range.to),
          analyticsService.getExpenses(scope, range),
        ]);
        data.pnl = {
          tuitionRevenue: data.revenue.tuitionTotal,
          goodsRevenue: data.revenue.goodsTotal,
          goodsGrossProfit: data.revenue.goodsGrossProfit,
          payrollExpense: data.expenses.payroll.amount,
          commissionExpense: data.expenses.commission.amount,
          operatingResult: data.revenue.goodsGrossProfit === null ? null : data.revenue.tuitionTotal + data.revenue.goodsGrossProfit - data.expenses.total,
        };
      } else if (report === "revenue") data.revenue = await analyticsService.getCombinedRevenue(scope, range);
      else if (report === "receivables") data.receivables = await analyticsService.getReceivables(scope, range.to);
      else if (report === "expenses") data.expenses = await analyticsService.getExpenses(scope, range);
      else data.pnl = await analyticsService.getProfitAndLoss(scope, range);

      const baseName = `analytics-${report}-${String(req.query.from)}-${String(req.query.to)}`;
      if (format === "csv") {
        const csv = buildAnalyticsCsv(report as Exclude<AnalyticsExportReport, "overview">, data);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=${baseName}.csv`);
        return res.send(csv);
      }
      const buffer = analyticsWorkbookBuffer(buildAnalyticsWorkbook(report, data));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${baseName}.xlsx`);
      return res.send(buffer);
    } catch (error: any) {
      console.error("[analyticsController.exportReport] Error:", error);
      return res.status(500).json({ status: "error", message: "Lỗi hệ thống khi xuất báo cáo.", details: error.message });
    }
  },
};
