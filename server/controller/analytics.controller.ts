import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { analyticsService, RevenueGranularity } from "../service/analytics.service";

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

export const analyticsController = {
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

      const data = await analyticsService.getTuitionRevenue(
        { companyCode: req.user.companyCode },
        range
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
};
