import { getAccessToken } from "./authService";
import { DashboardSummary, DashboardDateFilter, DashboardActionItems } from "../types/dashboard";

export interface DashboardSummaryParams {
  filter: DashboardDateFilter;
  startDate?: string;
  endDate?: string;
}

export const dashboardService = {
  /**
   * Lấy số liệu tổng hợp tất cả module cho trang tổng quan trong một request.
   */
  async getSummary(params: DashboardSummaryParams): Promise<DashboardSummary> {
    const qs = new URLSearchParams({ filter: params.filter });
    if (params.filter === "custom" && params.startDate && params.endDate) {
      qs.set("startDate", params.startDate);
      qs.set("endDate", params.endDate);
    }

    const res = await fetch(`/api/v1/dashboard/summary?${qs.toString()}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải dữ liệu tổng quan.");
    }

    const json = await res.json();
    return json.data as DashboardSummary;
  },

  /**
   * Lấy danh sách "Việc cần xử lý hôm nay" (task quá hạn, phiếu chờ duyệt, tồn kho thấp).
   */
  async getActionItems(): Promise<DashboardActionItems> {
    const res = await fetch("/api/v1/dashboard/action-items", {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải việc cần xử lý hôm nay.");
    }

    const json = await res.json();
    return json.data as DashboardActionItems;
  },
};
