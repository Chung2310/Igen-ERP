import { getAccessToken } from "./authService";
import { DashboardSummary, DashboardDateFilter, DashboardActionItems } from "../types/dashboard";
import { withRequestTimeout } from '../utils/requestTimeout';

export interface DashboardSummaryParams {
  filter: DashboardDateFilter;
  startDate?: string;
  endDate?: string;
}

export const dashboardService = {
  /**
   * Lấy số liệu tổng hợp tất cả module cho trang tổng quan trong một request.
   */
  async getSummary(params: DashboardSummaryParams, options: { signal?: AbortSignal; branchId?: string } = {}): Promise<DashboardSummary> {
    return withRequestTimeout(async (signal) => {
    const qs = new URLSearchParams({ filter: params.filter });
    if (params.filter === "custom" && params.startDate && params.endDate) {
      qs.set("startDate", params.startDate);
      qs.set("endDate", params.endDate);
    }

    const res = await fetch(`/api/v1/dashboard/summary?${qs.toString()}`, {
      signal,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        ...(options.branchId ? { 'x-branch-id': options.branchId } : {}),
      },
    });

    if (!res.ok) {
      throw new Error("Không thể tải dữ liệu tổng quan.");
    }

    const json = await res.json();
    return json.data as DashboardSummary;
    }, 20000, 'Tải tổng quan quá lâu. Vui lòng thử lại.', options.signal);
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
