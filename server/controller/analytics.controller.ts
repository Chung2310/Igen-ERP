import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { analyticsService } from "../service/analytics.service";

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
};
